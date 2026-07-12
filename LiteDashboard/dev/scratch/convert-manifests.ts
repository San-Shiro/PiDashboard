import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const WIDGETS_DIR = join(process.cwd(), 'widgets');

const pushWidgets = [
  'sysinfo',
  'weather',
  'music-player',
  'now-playing',
  'network-info',
  'gpio-display',
  'daily-quote'
];

try {
  const folders = readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'));

  for (const folder of folders) {
    const manifestPath = join(WIDGETS_DIR, folder, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    if (manifest.tier === 'native') {
      const isPush = pushWidgets.includes(folder);
      manifest.tier = isPush ? 'push' : 'static';
      
      if (isPush) {
        manifest.dataChannel = {
          type: 'ipc_file',
          ipcFilename: `${folder}.json`
        };
      } else {
        manifest.dataChannel = {
          type: 'none'
        };
      }

      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`Updated ${folder} to tier: ${manifest.tier}`);
    }
  }
} catch (e) {
  console.error('Error during conversion:', e);
}
