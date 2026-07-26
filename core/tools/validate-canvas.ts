import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { validateCanvas } from '../server/engine/validators/canvas-validator';

// A simple parsing of args
const args = process.argv.slice(2);
const canvasIndex = args.indexOf('--canvas');

if (canvasIndex === -1 || !args[canvasIndex + 1]) {
  console.log('Usage: bun run core/tools/validate-canvas.ts --canvas <path-to-json>');
  process.exit(1);
}

const canvasPath = args[canvasIndex + 1];

try {
  const content = readFileSync(canvasPath, 'utf8');
  const rawCanvas = JSON.parse(content);
  
  // get registered widgets
  const WIDGETS_DIR = join(process.cwd(), 'widgets');
  let registeredWidgets: string[] = [];
  try {
    registeredWidgets = readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'));
  } catch (e) {
    // If widgets dir doesn't exist yet, we still want to test the validator, so we just use empty
  }

  const result = validateCanvas(rawCanvas, registeredWidgets);

  if (result.valid) {
    console.log(`✓ Canvas valid${result.warnings.length ? ` (${result.warnings.length} warnings)` : ''}`);
    result.warnings.forEach(w => console.log(`    ⚠ ${w}`));
    process.exit(0);
  } else {
    console.log(`✗ Canvas invalid (${result.errors.length} errors)`);
    result.errors.forEach(e => console.log(`    ✗ ${e}`));
    result.warnings.forEach(w => console.log(`    ⚠ ${w}`));
    process.exit(1);
  }
} catch (e: any) {
  console.log(`Failed to validate canvas: ${e.message}`);
  process.exit(1);
}
