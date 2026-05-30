import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { Router, json, error } from '../router';
import { stateStore } from '../state/state-store';

const WIDGETS_DIR = join(process.cwd(), 'widgets');

export function registerWidgetRoutes(router: Router) {
  // GET /api/widgets/registry — return all widget manifests
  router.get('/api/widgets/registry', (req) => {
    const widgets: any[] = [];
    if (!existsSync(WIDGETS_DIR)) return json({ widgets });

    const folders = readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'));
    for (const folder of folders) {
      const manifestPath = join(WIDGETS_DIR, folder, 'manifest.json');
      if (!existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        widgets.push(manifest);
      } catch { /* skip broken manifests */ }
    }

    return json({ widgets });
  });

  // GET /api/widget-data/:name — bridge daemon state to admin polling
  router.get('/api/widget-data/:name', (req, params) => {
    const data = stateStore.get(params.name);
    return json(data);
  });
}
