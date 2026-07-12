import { readdirSync } from 'fs';
import { join } from 'path';
import { validateWidget } from '../core/engine/validators/widget-validator';

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
} catch (e) {
  console.log(`Error running validation:`, e);
}
