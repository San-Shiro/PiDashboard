const ws = new (require('ws'))('ws://localhost:3000/ws/display');
ws.on('open', () => console.log('connected'));
ws.on('message', data => console.log('Message:', data.toString()));
setTimeout(() => ws.close(), 1000);
