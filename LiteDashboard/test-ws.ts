const ws = new WebSocket('ws://localhost:3000/ws/display');
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'hello', role: 'display' }));
};
ws.onmessage = (event) => {
  console.log('Received:', event.data);
};
setTimeout(() => {
  ws.close();
  process.exit(0);
}, 3000);
