const sOptions = require('./argv.cmpl.json');
const { properties } = sOptions;

module.exports = function(argv, options) {
  for (var opt in options) {
    let sOpt = properties[opt];
    // custom
    let cOpt = options[opt];
    if (!sOpt) {
      continue;
    }
    
    switch (sOpt.type) {
      case 'boolean':
        if (cOpt || (sOpt.default && cOpt == sOpt.default)) {
          argv.push(`--${opt}`);
        }
        break;
      case 'string':
        if (!cOpt || (sOpt.default && cOpt == sOpt.default)) {
          continue;
        }
        argv.push(`--${opt}`);
        argv.push(cOpt);
        break;
      case 'number':
        if (cOpt == 0 || (sOpt.default && cOpt == sOpt.default)) {
          continue;
        }
        argv.push(`--${opt}`);
        argv.push(cOpt);
        break;
      default:
        if(sOpt.type instanceof Array){
          if (typeof cOpt == 'boolean') {
            if (cOpt) {
                argv.push('--' + opt);
            }
          }else if(typeof cOpt == 'string') {
            if (!cOpt) {
              continue;
            }
            argv.push('--' + opt);
            argv.push(cOpt);
          }
        }
        break;
    }
  }
};
