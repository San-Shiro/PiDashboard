import { broadcastLogs } from './ws/display';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

const MAX_LOGS = 300;
const logs: LogEntry[] = [];

// Save original console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

function formatArgs(args: any[]): string {
  return args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
}

export function addLog(level: 'info' | 'warn' | 'error', source: string, message: string) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message
  };

  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Broadcast
  broadcastLogs([entry]);
}

export function hijackConsole() {
  console.log = function (...args) {
    originalConsoleLog.apply(console, args);
    addLog('info', 'System', formatArgs(args));
  };
  console.warn = function (...args) {
    originalConsoleWarn.apply(console, args);
    addLog('warn', 'System', formatArgs(args));
  };
  console.error = function (...args) {
    originalConsoleError.apply(console, args);
    addLog('error', 'System', formatArgs(args));
  };
}

export function getLogs() {
  return logs;
}
