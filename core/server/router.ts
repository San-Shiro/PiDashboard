/**
 * Lightweight prefix-based HTTP router for Bun.serve.
 * Zero dependencies, supports path params and wildcards.
 */

type RouteHandler = (req: Request, params: Record<string, string>) => Response | Promise<Response>;
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Route {
  method: HttpMethod;
  pattern: string;
  segments: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];

  add(method: HttpMethod, pattern: string, handler: RouteHandler): void {
    this.routes.push({
      method,
      pattern,
      segments: pattern.split('/').filter(Boolean),
      handler,
    });
  }

  /** Convenience methods */
  get(pattern: string, handler: RouteHandler) { this.add('GET', pattern, handler); }
  post(pattern: string, handler: RouteHandler) { this.add('POST', pattern, handler); }
  put(pattern: string, handler: RouteHandler) { this.add('PUT', pattern, handler); }
  patch(pattern: string, handler: RouteHandler) { this.add('PATCH', pattern, handler); }
  delete(pattern: string, handler: RouteHandler) { this.add('DELETE', pattern, handler); }

  match(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } | null {
    const reqSegments = pathname.split('/').filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params: Record<string, string> = {};
      let matched = true;

      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i];

        if (seg === '*') {
          // Wildcard: capture the rest as 'path'
          params['*'] = reqSegments.slice(i).join('/');
          return { handler: route.handler, params };
        }

        if (i >= reqSegments.length) {
          matched = false;
          break;
        }

        if (seg.startsWith(':')) {
          // Path parameter
          params[seg.slice(1)] = decodeURIComponent(reqSegments[i]);
        } else if (seg !== reqSegments[i]) {
          matched = false;
          break;
        }
      }

      if (matched && reqSegments.length === route.segments.length) {
        return { handler: route.handler, params };
      }
    }

    return null;
  }
}

/** JSON response helpers */
export function json(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}
