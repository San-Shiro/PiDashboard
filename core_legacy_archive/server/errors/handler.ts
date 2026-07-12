import { logger } from "../utils/logger";

export function apiHandler(handler: Function) {
  return async (req: Request, server: any) => {
    try {
      return await handler(req, server);
    } catch (error: any) {
      logger.error("SYSTEM", `${req.method} ${req.url}: ${error.message}`);
      return new Response(
        JSON.stringify({ error: error.message, code: error.code || "INTERNAL_ERROR" }),
        { 
          status: error.status || 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  };
}

export function registerGlobalErrorHandlers() {
  process.on("uncaughtException", (error) => {
    logger.error("SERVER", `Uncaught Exception: ${error.message}`, error);
    // Do not exit, keep the server running
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("SERVER", `Unhandled Rejection: ${String(reason)}`);
  });
}
