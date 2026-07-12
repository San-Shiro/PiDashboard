import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { localApiPlugin } from "./vite-plugin-local-api";

// Set USE_BUN_PROXY=1 to proxy to the real Bun backend instead of using mocks
const useBunProxy = process.env.USE_BUN_PROXY === '1';

export default defineConfig({
  plugins: useBunProxy ? [react()] : [react(), localApiPlugin()],
  base: "/admin/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: useBunProxy ? {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
      '/weather': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    } : undefined,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
