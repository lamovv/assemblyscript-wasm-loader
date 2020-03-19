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

const getInBundleWasmModule = wasm => {
  const buffer = [];
  for (let i = 0, l = wasm.length; i < l; i++) {
    buffer.push(wasm[i]);
  }

  // 分配内存，创建view
  return `
    export default function init(imports){
      var buffer = new ArrayBuffer(${wasm.length});
      var ui8view = new Uint8Array(buffer);
      ui8view.set([${buffer.join(',')}]);
      return WebAssembly.instantiate(buffer, imports || {});
    };`;
};
const getWasmFileModule = publicPath => {
  return `
    export default function init(imports){
      return WebAssembly.instantiateStreaming(fetch(${publicPath}), imports || {});
    }`;
};

const loader = function(source) {
  // make the loader async, callback(err, content, sourceMap, AST);
  const callback = this.async();

  // check argv
  const options = getOptions(this) || {};
  const configuration = {
    name: 'assemblyscript-wasm-loader',
  };
  validate(argvOpt, options, configuration);
  if (this.cacheable) {
    this.cacheable();
  }

  const buildPath = this._compiler.outputPath;
  const output = join(
    buildPath,
    path.parse(this.resourcePath).name + '.wasm'
  );

  const argv = [
    // source
    path.relative(process.cwd(), this.resourcePath),
    // output
    '-o',
    path.relative(process.cwd(), output),
    // '--optimize',
  ];
  optUtils(argv, options);

  asc.ready.then(() => {
    // argv, options, callback
    asc.main(
      argv,
      {
        stdout: process.stdout,
        stderr: process.stderr,
      },
      err => {
        if (err) {
          return callback(err);
        }

        // Decide whether to build into Bundle or *.wasm
        const size = fs.statSync(output).size;
        const wasmFile = fs.readFileSync(output);

        let limit = 0;
        try {
          limit = +(options.limit || this.options.url.dataUrlLimit);
        } catch (e) {}

        // build in
        if (size <= limit) {
          return callback(null, getInBundleWasmModule(Buffer.from(wasmFile)));

        // separate wasm file,fetch
        } else {
          validate(outOpt, options, configuration, {useDefaults: true});
          
          // 获取 context
          const context = options.context // 自定义文件context
            || this.rootContext || (this.options && this.options.context);  // 从webpack 4开始，原先的 this.options.context 被改进为this.rootContext
          
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

          return callback(null, getWasmFileModule(publicPath));
        }
      }
    );
  });
};

module.exports = loader;
