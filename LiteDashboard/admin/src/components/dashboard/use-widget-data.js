import { useEffect, useState, useRef } from "react";

// Maintains a single WebSocket connection to the backend to receive live widget state.
// Mirrors the exact same data payload the Kiosk display uses.
export default function useWidgetData(activeWidgetIds = [], activeCanvas = null) {
  const [data, setData] = useState({});
  const wsRef = useRef(null);
  
  // Track the current active canvas as a ref so the websocket closure always has the latest
  const canvasRef = useRef(activeCanvas);
  useEffect(() => {
    canvasRef.current = activeCanvas;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Send the latest draft canvas to trigger dynamic daemon preview
      wsRef.current.send(JSON.stringify({ type: 'preview', canvas: activeCanvas }));
    }
  }, [activeCanvas]);

  useEffect(() => {
    // Determine WebSocket URL from current host
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/display`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Identify as admin to receive all state updates without showing up as a kiosk display
      ws.send(JSON.stringify({ type: "hello", role: "admin", canvasId: "admin-preview" }));
      
      // If we already have a canvas, send it as a preview
      if (canvasRef.current) {
        ws.send(JSON.stringify({ type: 'preview', canvas: canvasRef.current }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "state" && msg.widget) {
          setData((prev) => {
            const next = { ...prev };
            // Initialize widget object if missing
            if (!next[msg.widget]) next[msg.widget] = {};
            
            // Set instance or global data
            if (msg.instance === "global") {
              // If global, we replace the entire object (handling multiple instances inside if needed)
              next[msg.widget] = msg.data;
            } else {
              // Individual instance update
              next[msg.widget] = { ...next[msg.widget], [msg.instance]: msg.data };
            }
            return next;
          });
        }
      } catch (e) {
        console.error("Widget WebSocket parse error:", e);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  return data;
}
