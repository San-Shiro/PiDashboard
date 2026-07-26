import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { validateCanvas } from '../engine/validators/canvas-validator';
import { composeHTML } from '../engine/compositor';
import { CanvasConfig, WidgetManifest } from '../engine/schema';

const args = process.argv.slice(2);
const canvasIndex = args.indexOf('--canvas');
const outputIndex = args.indexOf('--output');

if (canvasIndex === -1 || !args[canvasIndex + 1] || outputIndex === -1 || !args[outputIndex + 1]) {
  console.log('Usage: bun run core/tools/canvas-preview.ts --canvas <path-to-json> --output <path-to-html>');
  process.exit(1);
}

const canvasPath = args[canvasIndex + 1];
const outputPath = args[outputIndex + 1];

try {
  const content = readFileSync(canvasPath, 'utf8');
  const rawCanvas = JSON.parse(content);
  
  // Load registry
  const WIDGETS_DIR = join(process.cwd(), 'widgets');
  const registry: { id: string, manifest: WidgetManifest, fragmentHTML: string }[] = [];
  
  try {
    const folders = readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'));
    for (const folder of folders) {
      const manifestPath = join(WIDGETS_DIR, folder, 'manifest.json');
      const manifestStr = readFileSync(manifestPath, 'utf8');
      const manifest: WidgetManifest = JSON.parse(manifestStr);
      
      const fragmentPath = join(WIDGETS_DIR, folder, manifest.fragment.file);
      const fragmentHTML = readFileSync(fragmentPath, 'utf8');
      
      registry.push({ id: manifest.id, manifest, fragmentHTML });
    }
  } catch (e) {
    console.warn('Could not load widgets registry. Rendering might be empty.');
  }

  const result = validateCanvas(rawCanvas, registry.map(r => r.id));

  if (!result.valid) {
    console.log(`✗ Canvas invalid. Cannot preview.`);
    result.errors.forEach(e => console.log(`    ✗ ${e}`));
    process.exit(1);
  }

  const html = composeHTML(result.sanitized as CanvasConfig, registry);
  
  writeFileSync(outputPath, html, 'utf8');
  console.log(`✓ Preview written to ${outputPath}`);
  process.exit(0);

} catch (e: any) {
  console.log(`Failed to generate preview: ${e.message}`);
  process.exit(1);
}
