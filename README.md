# `assemblyscript-wasm-loader`

> A webpack loader that compiles AssemblyScript to WebAssembly.

## Usage
1. 安装依赖

```bash
$ yarn add assemblyscript-wasm-loader -D
```

  - 注：可配置源地址加快yarn下包效率：`yarn config set registry https://registry.npm.taobao.org`，同时在待发npm包`package.json`增加配置：

    ```json
    "publishConfig": {
      "registry": "https://registry.npmjs.org"
    }
    ```

2. webpack 配置

```javascript
{
  test: /\.ts?$/,
  loader: 'assemblyscript-wasm-loader',
  include: /assembly/,
  options: {
    limit: 61440, // 编译的 wasm size 阈值(单位byte)，size <= limit build in Bundle；size > limit 生成 .wasm 文件
    optimize: '3z', // 编译优化，默认 2s
    // measure: true, // Prints measuring information on I/O and compile times
  }
}
```

优化项对应的配置

```json
{
  "-Os": { "value": { "optimize": true, "shrinkLevel": 1 } },
  "-Oz": { "value": { "optimize": true, "shrinkLevel": 2 } },
  "-O0": { "value": { "optimizeLevel": 0, "shrinkLevel": 0 } },
  "-O1": { "value": { "optimizeLevel": 1, "shrinkLevel": 0 } },
  "-O2": { "value": { "optimizeLevel": 2, "shrinkLevel": 0 } },
  "-O3": { "value": { "optimizeLevel": 3, "shrinkLevel": 0 } },
  "-O0s": { "value": { "optimizeLevel": 0, "shrinkLevel": 1 } },
  "-O1s": { "value": { "optimizeLevel": 1, "shrinkLevel": 1 } },
  "-O2s": { "value": { "optimizeLevel": 2, "shrinkLevel": 1 } },
  "-O3s": { "value": { "optimizeLevel": 3, "shrinkLevel": 1 } },
  "-O0z": { "value": { "optimizeLevel": 0, "shrinkLevel": 2 } },
  "-O1z": { "value": { "optimizeLevel": 1, "shrinkLevel": 2 } },
  "-O2z": { "value": { "optimizeLevel": 2, "shrinkLevel": 2 } },
  "-O3z": { "value": { "optimizeLevel": 3, "shrinkLevel": 2 } }
}
```

3. 开发代码，（如下示例）。也可直接安装 `@ufly/cli` 生成开发环境

// src/assembly/index.ts

```js
// import the JS API by env
@external('env', 'logi')
declare function logi(v: i64): void;
@external('env', 'logd')
declare function logd(s: string, i: i64): void;

export function compareVersion(va: string, vb: string, digit: i8 = 3): i8 {
  if(!va && !vb){
    return 0;
  }else if(!va){
    return -1;
  }else if(!vb){
    return 1;
  }

  const aArr: string[] = va.split('.');
  const bArr: string[] = vb.split('.');

  let i = -1;
  while(++i < digit){
    if(aArr[i] > bArr[i]){
      return 1;
    }else if(aArr[i] < bArr[i]){
      return -1;
    }
  }
  return 0;
}
```

// src/index.js

```js
import instantiate from './assembly/index.ts';

let wasmModulePromise;
// 共享内存
const testImports = {
  env: {
    logi: console.log,
    logd(s, num){ // log debug
      wasmModulePromise.then(({exports}) => {
        const str = exports.__getString(s);
        console.log(str, num);
      });
    }
  }
};

// Promise<fooModule>
wasmModulePromise = instantiate(testImports);

/**
 * @param {string} a
 * @param {string} b
 * @param {number=} digit
 * @returns {Promise<number>}
 */
export async function compareVersion(a, b, digit=3) {
  return wasmModulePromise.then(({ exports }) => {
    // 使用 exports 上挂载的实用方法获取 JS ”对象“数据内存地址，供 Wasm 使用: https://www.assemblyscript.org/loader.html#module-instance-utility
    let { compareVersion, __newString } = exports;
    // JS 只需将参数直接透传给 Wasm 即可
    const va = __newString(a);
    const vb = __newString(b);

    return compareVersion(va, vb, digit);
  }).catch(e){
    console.error('Error:', e);
  };
}

export default wasmModulePromise;
```

// demo/index.js
```js
import wasmModulePomise, {
  compareVersion
} from '../src/index.js';

wasmModPromise.then(({ exports }) => {
  // https://www.assemblyscript.org/loader.html#module-instance-utility
  let { compareVersion, __newString } = exports;

  let a2;
  let b2;
  const ts = Date.now();

  for(var j=0; j< 100000; j++){
    a2 = __newString(`1.2.${j}`);
    b2 = __newString('1.2.100');
    compareVersion(a2, b2);
  }
  const te = Date.now();
  console.log('js-wasm', te - ts);
});
```

## 其他
- Promise.reject，根据失败的原因不同，当前有 3 类异常：
  - [WebAssembly.CompileError](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/CompileError)
  - [WebAssembly.LinkError](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/LinkError)
  - [WebAssembly.RuntimeError](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/RuntimeError)

- importsObject 配置，WebAssembly的实例化方法，可导入 4 种类型：
  - values
  - function
  - memory(JS与Wasm间内存共享)
  - tables(主要用于函数引用)

  注：wasm模块中，若导入值，要与之匹配的属性对应，否则会抛出 [WebAssembly.LinkError](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/LinkError)。

  JS ：

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
