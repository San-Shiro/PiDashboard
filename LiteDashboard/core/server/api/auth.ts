import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Router, json, error } from '../router';

const CONFIG_PATH = join(process.cwd(), 'config.json');

// In-memory session store (sessions expire on server restart — fine for single-admin Pi)
const sessions = new Map<string, { created: Date }>();

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
  if (sessionId && sessions.has(sessionId)) return sessionId;
  return null;
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

    // Create session
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { created: new Date() });

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
