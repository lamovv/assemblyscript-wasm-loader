# `assemblyscript-wasm-loader`

> A webpack loader that compiles AssemblyScript to WebAssembly.

## Usage
1. install

```bash
$> npm install assemblyscript-wasm-loader
```

2. webpack 配置

```javascript
{
  test: /\.ts?$/,
  loader: 'assemblyscript-wasm-loader',
  include: /assembly/,
  options: {
    //关键配置，是否打进Bundle
    limit: 61440, // wasm size 阈值(单位byte)，是否build in Bundle,size <= limit即打入Bundle，反之生成name.wasm 文件
    // sourceMap: true,
    // debug: true
  }
}
```

3. 开发代码

// assembly/index.ts

```js
// the env from JS
@external('env', 'log')
export declare function logi(v: i32): void;
@external('env', 'log')
export declare function logs(a: string): void;
@external('env', 'log')
export declare function logss(a: string, b: string): void;
@external('env', 'gValue')
export declare const gValue:i32;

/**
 *  @return
 *  - a > b ，return 1
 *  - a = b ，return 0
 *  - a < b ，return -1
 */
export function compareVersion(va: string, vb: string, digit: i8 = 3): i8 {
  logi(gValue);
  logss(va, vb);
  
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

// demo/index.js

```js
const imports = {
  env: {
    gValue: 666,
    log: console.log,
    abort: function abort(message, source, lineno, colno) {
      const memory = env.memory;
      throw Error(`abort: ${getString(memory, mesg)} at ${getString(memory, file)}:${lineno}:${colno}`);
    }
  }
};

// module挂载API参照 [@assemblyscript/loader](https://web.npm.alibaba-inc.com/package/@assemblyscript/loader)
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

//关键用法
import instantiate from '../assembly/index.ts';
instantiate(utilImports).then(utilMod => {
  cback(utilMod);
}).catch(e => console.error(e));
```

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
