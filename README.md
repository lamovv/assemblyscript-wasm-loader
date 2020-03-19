# `assemblyscript-wasm-loader`

> A webpack loader that compiles AssemblyScript to WebAssembly.

## Usage
1. install

```bash
$> npm install assemblyscript-wasm-loader
```

1. webpack 配置

```javascript
{
  test: /\.ts?$/,
  loader: 'assemblyscript-wasm-loader',
  include: /assembly/,
  options: {
    // 构建出的wasm大小决定是否build in Build的限制(阈值，单位byte), <= limit即打入Bundle，反之，构建独立 name.wasm 文件
    limit: 61440,
    name: '[name].[hash:8].wasm',
    sourceMap: true
  }
}
```

2. 应用

```js
const utilImports = {
  env: {
    gValue: 666,
    log: console.log,
    memory: new WebAssembly.Memory({initial: 10}),
    table: new WebAssembly.Table({initial: 1, element: 'anyfunc'}),
    abort: function abort(message, source, lineno, colno) {
      const memory = env.memory;
      throw Error(`abort: ${getString(memory, mesg)} at ${getString(memory, file)}:${lineno}:${colno}`);
    }
  }
};

const cback = utilMod => {
  let { 
  compareVersion, 
  __allocString,
  __retain, 
  __release 
} = utilMod;

  const a = '1.2.0';
  const b = '1.2.1';
  const va = __retain(__allocString(a));
  const vb = __retain(__allocString(b));

  const r = compareVersion(va, vb);

  console.log(
    `%c 版本 ${a} 比版本 ${b} ${{ 0: '相等', 1: '大', '-1': '小' }[r]}`,
    'color:#0f0;'
  );
  __release(va);
  __release(vb);
};

//下个版本优化loader，集成此依赖
import loader from '@assemblyscript/loader';
import init from '../assembly/index.ts';

init(utilImports).then(({ instance, module }) => {
  loader.instantiate(module, utilImports).then(utilMod => {
    cback(utilMod);
  });
});
```

- 编译与实例化WebAssembly模块
  - Build in Bundle时，使用 `Promise<ResultObject> WebAssembly.instantiate(bufferSource, importObject);`
  - 获取(fetch)时，使用 `Promise<ResultObject> WebAssembly.instantiateStreaming(source, importObject);`

- Promise.reject，根据失败的原因不同，当前有 3 类异常：
  - [WebAssembly.CompileError](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/CompileError)
  - [WebAssembly.LinkError](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/LinkError)
  - [WebAssembly.RuntimeError](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/RuntimeError)

## importsObject 配置
WebAssembly的实例化方法，可导入 4 种类型：

- values
- function
- memory(JS与Wasm间内存共享)
- tables(主要用于函数引用)

wasm模块中，若导入值，要与之匹配的属性对应，否则会抛出 [WebAssembly.LinkError](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/LinkError)。

```javascript
const utilImports = {
  env: {
    gValue: 666,
    log: console.log,
    //以wasm页(64K)为单位，初始640K，不必要配置最大限制
    memory: new WebAssembly.Memory({initial: 10}),
    //初始指定1个长度，不必要配置最大限制；存储对象的类型目前只支持函数
    table: new WebAssembly.Table({initial: 1, element: 'anyfunc'}),
    abort: function abort(message, source, lineno, colno) {
      const memory = env.memory;
      throw Error(`abort: ${getString(memory, mesg)} at ${getString(memory, file)}:${lineno}:${colno}`);
    }
  }
};
```
