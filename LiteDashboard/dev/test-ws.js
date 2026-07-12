const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws/display');
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'widget_state_save', instance: 'notepad_1', state: { text: 'test from node' } }));
  setTimeout(() => process.exit(0), 100);
});
