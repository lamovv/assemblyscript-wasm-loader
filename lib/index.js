const fs = require('fs');
const path = require('path');
const { sep, join, posix } = path;
const asc = require('assemblyscript/cli/asc');
const loaderUtils = require('loader-utils');
const { getOptions, interpolateName } = loaderUtils;
const validate = require('schema-utils2');

const argvOpt = require('./argv.cmpl.json');
const outOpt = require('./options.out.json');
const optUtils = require('./argv.utils');
const loaderpkg = '@assemblyscript/loader';

const getInBundleWasmModule = wasm => {
  const buffer = [];
  for (let i = 0, l = wasm.length; i < l; i++) {
    buffer.push(wasm[i]);
  }

  // 分配内存，创建view
  return `
    import loader from '${loaderpkg}';
    export default function init(imports){
      var buffer = new ArrayBuffer(${wasm.length});
      var ui8view = new Uint8Array(buffer);
      ui8view.set([${buffer.join(',')}]);
      return loader.instantiate(buffer, imports || {});
    };`;
};
const getWasmFileModule = publicPath => {
  return `
    import loader from '${loaderpkg}';
    export default function init(imports){
      return loader.instantiateStreaming(fetch(${publicPath}), imports || {});
    }`;
};

const loader = function(content) {
  // callback(err, content, sourceMap, AST);
  const callback = this.async();
  this.addDependency(loaderpkg);

  // check argv
  const options = getOptions(this) || {};
  const configuration = {
    name: 'assemblyscript-wasm-loader',
  };

  validate(argvOpt, options, configuration);

  const buildPath = this._compiler.outputPath;
  const output = join(
    buildPath,
    path.parse(this.resourcePath).name + '.wasm'
  );

  let argv = [
    path.relative(process.cwd(), this.resourcePath),  // source
    '-o', path.relative(process.cwd(), output), // output
  ];
  optUtils(argv, options);
  validate(outOpt, options, configuration, {useDefaults: true});

  asc.ready.then(() => {
    // argv, options, callback
    asc.main(
      argv,
      err => {
        if (err) {
          callback(err);
        }else{
          // Decide whether to build into Bundle or *.wasm
          const size = fs.statSync(output).size;
          const wasmFile = fs.readFileSync(output);
          //TODO
          let sourceMap;
          try{
            // sourceMap = JSON.parse(fs.readFileSync(sourceMapPath));
            fs.unlink(output, e=>e);
            // fs.unlink(sourceMapPath, e=>e);
          }catch(e){}

          let limit = 0;
          try {
            limit = +options.limit;
          } catch (e) {}

          // build in
          if (size <= limit) {
            callback(null, getInBundleWasmModule(Buffer.from(wasmFile)), sourceMap);

          // separate wasm file,fetch
          } else {
            // 获取 context
            const context = this.rootContext;
            
            // 生成output文件名，loaderContext, name, options
            const url = interpolateName(
              this, 
              options.name, // 默认[hash].ts
              {
                context,
                content: wasmFile,
              }
            );
            
            // 处理 outputPath，output文件存储的位置
            let outputPath = url;
            if (options.outputPath) {
              if (typeof options.outputPath == 'function') {
                outputPath = options.outputPath(url);
              } else {
                outputPath = join(options.outputPath, url);
              }
            }

            if (options.useRelativePath) {
              const filePath = this.resourcePath;
              const issuerContext = context || (this._module && this._module.issuer && this._module.issuer.context);
              const relativeUrl = issuerContext && path.relative(issuerContext, filePath);

              const relativePath = relativeUrl && path.dirname(relativeUrl);
              if (~relativePath.indexOf(`..${sep}`)) {
                outputPath = join(outputPath, relativePath, url);
              } else {
                outputPath = join(relativePath, url);
              }
            }

            //处理 publicPath，文件中代码的路径的处理
            let publicPath = `__webpack_public_path__ + ${JSON.stringify(url)}`;
            if (options.publicPath !== undefined) {
              // support functions as publicPath to generate them dynamically
              publicPath = JSON.stringify(typeof options.publicPath == 'function' ? options.publicPath(url) : options.publicPath + url);
            }

            //处理 emitFile，默认true，会生成文件
            if (options.emitFile === undefined || options.emitFile) {
              this.emitFile(outputPath, wasmFile);
            }

            callback(null, getWasmFileModule(publicPath), sourceMap);
          }
        }
      }
    );
  });

  return;
};

module.exports = loader;
