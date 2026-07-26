import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Router, json, error } from '../router';

const CONFIG_PATH = join(process.cwd(), 'config.json');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const sessions = new Map<string, { created: number }>();

const LOGIN_WINDOW_MS = 60 * 1000;
const MAX_LOGIN_FAILURES = 10;
// Failed-login timestamps keyed by client IP. A successful login clears the IP,
// so an attacker's failures cannot lock out a legitimate admin on a different IP.
const loginFailures = new Map<string, number[]>();

export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (loginFailures.get(ip) || []).filter(t => now - t < LOGIN_WINDOW_MS);
  if (arr.length) loginFailures.set(ip, arr); else loginFailures.delete(ip);
  return arr.length >= MAX_LOGIN_FAILURES;
}

export function recordLoginResult(ip: string, success: boolean) {
  if (success) {
    loginFailures.delete(ip);
    return;
  }
  const now = Date.now();
  const arr = (loginFailures.get(ip) || []).filter(t => now - t < LOGIN_WINDOW_MS);
  arr.push(now);
  loginFailures.set(ip, arr);
}

function loadConfig(): any {
  if (!existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

function saveConfig(data: any) {
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get('cookie') || '';
  const cookies: Record<string, string> = {};
  header.split(';').forEach(part => {
    const [key, ...val] = part.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

export function getSessionFromRequest(req: Request): string | null {
  const cookies = parseCookies(req);
  const sessionId = cookies['pi-session'];
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.created > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }
  return sessionId;
}

export function isValidSession(cookieHeader: string): boolean {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(part => {
    const [key, ...val] = part.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  const sessionId = cookies['pi-session'];
  if (!sessionId) return false;
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (Date.now() - session.created > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

export function registerAuthRoutes(router: Router) {
  // GET /api/auth/status
  router.get('/api/auth/status', (req) => {
    const config = loadConfig();
    const isConfigured = !!config.passwordHash;
    const isAuthenticated = !!getSessionFromRequest(req);
    return json({ isConfigured, isAuthenticated });
  });

  // POST /api/auth/setup — first-time password setup
  router.post('/api/auth/setup', async (req) => {
    const config = loadConfig();
    if (config.passwordHash) {
      return error('Password already configured', 400);
    }

    const body = await req.json() as { password?: string };
    if (!body.password || body.password.length < 4) {
      return error('Password must be at least 4 characters', 400);
    }

    const hash = await Bun.password.hash(body.password, 'argon2id');
    config.passwordHash = hash;
    saveConfig(config);

    return json({ success: true });
  });

  // POST /api/auth/login
  // Rate limiting is applied per-IP in the server entry (needs requestIP).
  router.post('/api/auth/login', async (req) => {
    const config = loadConfig();
    if (!config.passwordHash) {
      return error('Password not configured. Use /api/auth/setup first.', 400);
    }

    const body = await req.json() as { password?: string };
    if (!body.password) {
      return error('Password required', 400);
    }

    const valid = await Bun.password.verify(body.password, config.passwordHash);
    if (!valid) {
      return json({ error: 'Invalid password' }, 401);
    }

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { created: Date.now() });

    return json({ success: true }, 200, {
      'Set-Cookie': `pi-session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
    });
  });

  // POST /api/auth/logout
  router.post('/api/auth/logout', (req) => {
    const sessionId = getSessionFromRequest(req);
    if (sessionId) sessions.delete(sessionId);

    return json({ success: true }, 200, {
      'Set-Cookie': 'pi-session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    });
  });

  // POST /api/auth/change-password
  router.post('/api/auth/change-password', async (req) => {
    const session = getSessionFromRequest(req);
    if (!session) return error('Not authenticated', 401);

    const body = await req.json() as { currentPassword?: string; newPassword?: string };
    if (!body.currentPassword || !body.newPassword) return error('Both passwords required', 400);
    if (body.newPassword.length < 4) return error('New password must be at least 4 characters', 400);

    const config = loadConfig();
    const valid = await Bun.password.verify(body.currentPassword, config.passwordHash);
    if (!valid) return json({ error: 'Current password is incorrect' }, 401);

    config.passwordHash = await Bun.password.hash(body.newPassword, 'argon2id');
    saveConfig(config);
    return json({ success: true });
  });
}
