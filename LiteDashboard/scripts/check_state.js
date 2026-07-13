const fs = require('fs');
const { stateStore } = require('./core/server/state/state-store.js');

const cryptoState = stateStore.get('crypto-desk');
console.log('crypto-desk state:', cryptoState);

const ipcData = fs.readFileSync('state/ipc/crypto-desk.json', 'utf8');
console.log('ipcData length:', ipcData.length);
