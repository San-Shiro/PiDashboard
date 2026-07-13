const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws/display');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'hello', role: 'admin', canvasId: 'admin-preview' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'state' && msg.widget === 'crypto-desk') {
    console.log('Received crypto-desk state!');
    console.log(JSON.stringify(msg, null, 2));
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('Timeout waiting for crypto-desk state');
  process.exit(1);
}, 5000);
