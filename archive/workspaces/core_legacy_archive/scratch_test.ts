import { existsSync, statSync } from "fs";
import { join } from "path";

console.log("Checking path exists...");
const path = join(process.cwd(), "admin", "dist", "index.html");
console.log("Path:", path);
console.log("Exists:", existsSync(path));
console.log("Is File:", statSync(path).isFile());

const server = Bun.serve({
  port: 3005,
  fetch(req) {
    console.log("Request received:", req.url);
    return new Response(Bun.file(path));
  }
});

console.log("Listening on 3005...");
