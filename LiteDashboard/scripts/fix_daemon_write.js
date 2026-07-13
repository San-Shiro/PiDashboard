const fs = require('fs');

let daemonCode = fs.readFileSync('widgets/crypto-desk/daemon/daemon.ts', 'utf8');

daemonCode = daemonCode.replace(
  "writeFileSync(ipcPath, JSON.stringify(cachedOutput), 'utf8');",
  "const tmpPath = ipcPath + '.tmp';\n      writeFileSync(tmpPath, JSON.stringify(cachedOutput), 'utf8');\n      renameSync(tmpPath, ipcPath);"
);

fs.writeFileSync('widgets/crypto-desk/daemon/daemon.ts', daemonCode);
console.log('Fixed daemon.ts to write atomically.');
