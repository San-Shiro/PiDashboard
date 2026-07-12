import { useState, useEffect, useRef } from "react";
import { Terminal, X, AlertTriangle, Info, PlayCircle } from "lucide-react";

export default function LogsViewer({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("all"); // 'all', 'system', 'daemons', 'errors'
  const endRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    // We reuse the existing display WS if possible, but it's simpler to open a new one
    // wait, we can just connect to `/ws/display` and send `subscribe_logs`.
    const ws = new WebSocket(`${protocol}//${host}/ws/display`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "hello", role: "admin", canvasId: "logs-viewer" }));
      ws.send(JSON.stringify({ type: "subscribe_logs" }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "logs") {
          setLogs(prev => {
            const next = [...prev, ...msg.logs];
            return next.slice(-300); // keep last 300
          });
        }
      } catch (err) {
        // ignore
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    if (filter === "errors") return log.level === "error";
    if (filter === "system") return log.source === "System";
    if (filter === "daemons") return log.source.startsWith("Daemon:");
    return true;
  });

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div 
        className="relative w-full max-w-4xl h-[80vh] flex flex-col rounded-xl overflow-hidden shadow-2xl border"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-2)" }}>
          <div className="flex items-center gap-2">
            <Terminal size={16} style={{ color: "var(--color-text-secondary)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>System Logs</h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="text-xs rounded border px-2 py-1 outline-none"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
            >
              <option value="all">All Logs</option>
              <option value="system">System Only</option>
              <option value="daemons">Daemons Only</option>
              <option value="errors">Errors Only</option>
            </select>
            <button onClick={onClose} className="p-1 hover:bg-black/10 rounded">
              <X size={16} style={{ color: "var(--color-text-secondary)" }} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed" style={{ backgroundColor: "#0a0a0a", color: "#e5e7eb" }}>
          {filteredLogs.length === 0 ? (
            <div className="text-center mt-10 text-gray-500 italic">No logs found...</div>
          ) : (
            filteredLogs.map((log, idx) => {
              const date = new Date(log.timestamp);
              const time = date.toLocaleTimeString([], { hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
              
              let color = "#e5e7eb";
              let IconComp = Info;
              if (log.level === "error") { color = "#ef4444"; IconComp = AlertTriangle; }
              if (log.level === "warn") { color = "#eab308"; IconComp = AlertTriangle; }
              if (log.source.startsWith("Daemon:")) { color = "#3b82f6"; IconComp = PlayCircle; }
              
              return (
                <div key={idx} className="flex gap-3 py-0.5 break-all border-b border-white/5 hover:bg-white/5" style={{ color }}>
                  <div className="shrink-0 opacity-50 flex items-center gap-1.5" style={{ minWidth: "120px" }}>
                    <IconComp size={10} />
                    {time}
                  </div>
                  <div className="shrink-0 opacity-70 font-semibold" style={{ width: "90px" }}>
                    [{log.source.replace("Daemon: ", "")}]
                  </div>
                  <div className="flex-1 whitespace-pre-wrap">
                    {log.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
