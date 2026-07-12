import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SECRETS_DIR = join(process.cwd(), "secrets");
const PASSHASH_PATH = join(SECRETS_DIR, "admin.passhash");
const SESSION_SECRET_PATH = join(SECRETS_DIR, "session.secret");

// Ensure secrets directory exists
if (!existsSync(SECRETS_DIR)) {
  mkdirSync(SECRETS_DIR, { recursive: true });
}

// Generate default passhash ("admin") if missing
if (!existsSync(PASSHASH_PATH)) {
  const defaultHash = await Bun.password.hash("admin", { algorithm: "argon2id" });
  writeFileSync(PASSHASH_PATH, defaultHash, "utf8");
}

// Generate session secret if missing
if (!existsSync(SESSION_SECRET_PATH)) {
  const secret = crypto.randomUUID();
  writeFileSync(SESSION_SECRET_PATH, secret, "utf8");
}

const SESSION_SECRET = readFileSync(SESSION_SECRET_PATH, "utf8");

// Memory map of active session tokens (lightweight in-memory DB)
const activeSessions = new Set<string>();

export async function login(password: string): Promise<string | null> {
  try {
    const hash = readFileSync(PASSHASH_PATH, "utf8").trim();
    const isMatch = await Bun.password.verify(password, hash);
    if (!isMatch) return null;

    // Generate secure session token
    const token = crypto.randomUUID();
    activeSessions.add(token);
    return token;
  } catch (e) {
    console.error(`[auth] Login error: ${(e as Error).message}`);
    return null;
  }
}

export function logout(token: string): void {
  activeSessions.delete(token);
}

export function isValidSession(token: string): boolean {
  return activeSessions.has(token);
}

// Cookie Helpers
export function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((pair) => {
    const parts = pair.split("=");
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  });
  return cookies;
}

// Middleware Check
export function checkAuth(req: Request): boolean {
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies["session_token"];
  return !!token && isValidSession(token);
}
