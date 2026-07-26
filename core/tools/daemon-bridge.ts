import { parseArgs } from "util";
import { spawn } from "child_process";

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    widget: { type: 'string' },
    host: { type: 'string', default: 'ws://localhost:3000/ws/daemon' },
    cmd: { type: 'string' }
  },
  strict: true,
  allowPositionals: true,
});

if (!values.widget) {
  console.error("Usage: bun run core/tools/daemon-bridge.ts --widget <widgetId> [--host <url>] [--cmd <executable>]");
  process.exit(1);
}

const widgetId = values.widget;
const wsUrl = `${values.host}?id=${widgetId}`;

let child: ReturnType<typeof spawn> | null = null;
if (values.cmd) {
  const parts = values.cmd.split(' ');
  child = spawn(parts[0], parts.slice(1), { stdio: ['pipe', 'pipe', 'inherit'], shell: true });
  child.on('exit', () => process.exit(0));
}

let ws: WebSocket | null = null;
let reconnectDelay = 1000;
const maxDelay = 30000;
let lastLine: string | null = null;

function connect() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    reconnectDelay = 1000; // reset
    // Handshake
    ws!.send(JSON.stringify({ type: 'hello', role: 'daemon', daemonId: widgetId }));
    
    // Flush buffered line if we have one
    if (lastLine) {
      processLine(lastLine);
      lastLine = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data.toString());
      if (msg.type === 'cmd') {
        const cmdStr = JSON.stringify(msg.data) + '\n';
        if (child) {
          child.stdin.write(cmdStr);
        } else {
          process.stdout.write(cmdStr);
        }
      }
    } catch {
      // ignore malformed
    }
  };

  ws.onclose = () => {
    ws = null;
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
      connect();
    }, reconnectDelay);
  };
}

function processLine(line: string) {
  line = line.trim();
  if (!line) return;
  
  try {
    const delta = JSON.parse(line);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'patch',
        widget: widgetId,
        delta: delta
      }));
    } else {
      lastLine = line; // buffer it
    }
  } catch (err) {
    // Not valid JSON, ignore
  }
}

connect();

// Read output from either the child process or stdin
async function readStream(stream: any) {
  let buffer = '';
  for await (const chunk of stream) {
    buffer += new TextDecoder().decode(chunk);
    let n = buffer.indexOf('\n');
    while (n !== -1) {
      processLine(buffer.slice(0, n));
      buffer = buffer.slice(n + 1);
      n = buffer.indexOf('\n');
    }
  }
  if (buffer) processLine(buffer);
}

readStream(child ? child.stdout : Bun.stdin.stream());
