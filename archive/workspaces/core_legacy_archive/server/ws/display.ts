import { logger } from "../utils/logger";

// Connection registry for kiosk WebSockets
export const kiosks = new Set<any>();

export function pushData(widgetId: string, data: object) {
  const msg = JSON.stringify({ type: "data", widget: widgetId, data });
  for (const ws of kiosks) {
    try {
      ws.send(msg);
    } catch (e) {}
  }
}

export function pushReload() {
  const msg = JSON.stringify({ type: "reload" });
  for (const ws of kiosks) {
    try {
      ws.send(msg);
    } catch (e) {}
  }
}

export function pushMaintenance(enabled: boolean) {
  const msg = JSON.stringify({ type: "maintenance", enabled });
  for (const ws of kiosks) {
    try {
      ws.send(msg);
    } catch (e) {}
  }
}

export function handleConnection(ws: any) {
  kiosks.add(ws);
  logger.info("WEBSOCKET", `Kiosk connected successfully. Active: ${kiosks.size}`);
}

export function handleDisconnection(ws: any) {
  kiosks.delete(ws);
  logger.info("WEBSOCKET", `Kiosk disconnected. Active: ${kiosks.size}`);
}
