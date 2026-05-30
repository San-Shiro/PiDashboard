import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { localApiPlugin } from "./vite-plugin-local-api";

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 5173,
    // proxy removed since localApiPlugin handles /api
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
