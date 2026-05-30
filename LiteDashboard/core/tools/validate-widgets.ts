import { readdirSync } from 'fs';
import { join } from 'path';
import { validateWidget } from '../server/engine/validators/widget-validator';

const WIDGETS_DIR = join(process.cwd(), 'widgets');

try {
  const folders = readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'));

  let passed = 0, failed = 0;

  for (const folder of folders) {
    const result = validateWidget(join(WIDGETS_DIR, folder));
    
    if (result.valid) {
      console.log(`✓ ${folder}: OK${result.warnings.length ? ` (${result.warnings.length} warnings)` : ''}`);
      result.warnings.forEach(w => console.log(`    ⚠ ${w}`));
      passed++;
    } else {
      console.log(`✗ ${folder}: REJECTED`);
      result.errors.forEach(e => console.log(`    ✗ ${e}`));
      result.warnings.forEach(w => console.log(`    ⚠ ${w}`));
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
} catch (e) {
  console.log(`Widgets directory not found at ${WIDGETS_DIR}.`);
  process.exit(1);
}
