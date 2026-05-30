import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000/ws/display');

ws.on('open', () => {
  console.log('Connected to display hub');
  ws.send(JSON.stringify({ type: 'hello', role: 'display', canvasId: 'test' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'state') {
    console.log(`[STATE] ${msg.widget}:${msg.instance} =>`, msg.data);
  } else {
    console.log(`[${msg.type}]`, msg);
  }
});

ws.on('error', (err) => console.error('WS Error:', err));
ws.on('close', () => console.log('WS Closed'));
