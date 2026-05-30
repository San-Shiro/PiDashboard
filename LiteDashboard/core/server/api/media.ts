import { readdirSync, existsSync, mkdirSync, unlinkSync, statSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { Router, json, error } from '../router';

const UPLOADS_DIR = join(process.cwd(), 'media', 'uploads');

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ico': 'image/x-icon',
};

function sanitizeFilename(name: string): string {
  // Remove path separators, keep alphanumeric + -_. ()
  return name.replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 200);
}

export function registerMediaRoutes(router: Router) {
  // GET /api/media — list uploaded media files
  router.get('/api/media', () => {
    if (!existsSync(UPLOADS_DIR)) return json({ files: [] });

    const entries = readdirSync(UPLOADS_DIR);
    const files = entries
      .filter(f => !f.startsWith('.'))
      .map(filename => {
        const filePath = join(UPLOADS_DIR, filename);
        const stat = statSync(filePath);
        const ext = extname(filename).toLowerCase();
        return {
          filename,
          url: `/media/${filename}`,
          size: stat.size,
          mime_type: MIME_MAP[ext] || 'application/octet-stream',
          usage: { activeUses: [], inactiveTemplateUses: [] },
        };
      });

    return json({ files });
  });

  // POST /api/media/upload — upload a file via FormData
  router.post('/api/media/upload', async (req) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return json({ success: false, error: 'No file provided' }, 400);

      const safeName = sanitizeFilename(file.name);
      if (!safeName) return json({ success: false, error: 'Invalid filename' }, 400);

      const arrayBuffer = await file.arrayBuffer();
      const filePath = join(UPLOADS_DIR, safeName);
      writeFileSync(filePath, Buffer.from(arrayBuffer));

      return json({ success: true, filename: safeName, url: `/media/${safeName}` });
    } catch (e: any) {
      return json({ success: false, error: e.message || 'Upload failed' }, 500);
    }
  });

  // DELETE /api/media/:filename — delete uploaded file
  router.delete('/api/media/:filename', (req, params) => {
    const safeName = sanitizeFilename(params.filename);
    const filePath = join(UPLOADS_DIR, safeName);

    if (!existsSync(filePath)) return error('File not found', 404);

    unlinkSync(filePath);
    return json({ success: true });
  });
}
