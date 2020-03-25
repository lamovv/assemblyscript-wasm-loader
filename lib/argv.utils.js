const sOptions = require('./argv.cmpl.json');
const { properties } = sOptions;

module.exports = function(argv, options) {
  for (var opt in properties) {
    let sOpt = properties[opt];
    if (!sOpt) {
      continue;
    }
    // custom
    let cOpt = options[opt];
    //选项配置了值，而且非默认项，追加argv
    switch (sOpt.type) {
      case 'boolean':
        // 用户配置，或默认开启
        if (cOpt !== undefined || sOpt.default) {
          argv.push(`--${opt}`);
        }
        break;
      case 'string':
        // 用户未配置，且无默认项跳过
        if (!cOpt && sOpt.default === undefined) {
          continue;
        }
        if(opt == 'optimize'){
          argv.push(`-O${cOpt || sOpt.default}`);
          continue;
        }
        // 用户配置，或有默认项
        argv.push(`--${opt}`);
        if(cOpt){
          argv.push(cOpt);
        }else if(sOpt.default){
          argv.push(sOpt.default);
        }
        break;
      case 'number':
        // 配置0，或无默认值，或与编译默认值相同，跳过
        if (!cOpt || (sOpt.default && cOpt === sOpt.default)) {
          continue;
        }
        argv.push(`--${opt}`);
        argv.push(cOpt);
        break;
      default:
        break;
    }
  }
};
