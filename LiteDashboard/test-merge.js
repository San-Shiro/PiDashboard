const { deepMerge } = require('./dist/core/utils/deep-merge');
console.log(deepMerge({ note: 'test' }, { note: '' }));
