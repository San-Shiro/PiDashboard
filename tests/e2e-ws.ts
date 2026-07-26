const wsUrl = 'ws://localhost:3000/ws/display';
async function runTests() {
  let ws = new WebSocket(wsUrl);
  let resolveTests;
  let testPromise = new Promise(r => resolveTests = r);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'hello', role: 'display' }));
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'cmd', daemon: 'buttons', data: { action: 'click' } }));
    }, 1000);
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'state' && msg.widget === 'buttons') {
      console.log('Buttons:', msg.data.clicks);
    }
  };
  setTimeout(() => { ws.close(); resolveTests(); }, 2000);
  await testPromise;
  process.exit(0);
}
runTests();
