import { getSessionFromRequest } from '../api/auth';
import { json } from '../router';

/**
 * Auth gate middleware. Returns null if authenticated (allow request),
 * or a 401 Response if not authenticated.
 */
export function requireAuth(req: Request): Response | null {
  const session = getSessionFromRequest(req);
  if (session) return null; // Authenticated — proceed
  return json({ error: 'Unauthorized' }, 401);
}
