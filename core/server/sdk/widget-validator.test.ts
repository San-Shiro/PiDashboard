import { describe, it, expect } from 'bun:test';
import { validateWidget } from '../../engine/validators/widget-validator';
import { join } from 'path';

const FIXTURES_DIR = join(process.cwd(), 'core', 'test-fixtures', 'widgets');

describe('Widget Validator', () => {
  it('accepts valid static widget', () => {
    const result = validateWidget(join(FIXTURES_DIR, 'valid-static'));
    expect(result.valid).toBe(true);
  });
  
  it('rejects fragment containing <!DOCTYPE html>', () => {
    const result = validateWidget(join(FIXTURES_DIR, 'invalid-doctype'));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('<!DOCTYPE'))).toBe(true);
  });
  
  it('rejects verified widget containing eval()', () => {
    const result = validateWidget(join(FIXTURES_DIR, 'invalid-eval'));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('eval()'))).toBe(true);
  });
  
  it('accepts core widget containing eval()', () => {
    const result = validateWidget(join(FIXTURES_DIR, 'valid-core-eval'));
    expect(result.valid).toBe(true);
  });
  
  it('rejects missing manifest.json', () => {
    const result = validateWidget(join(FIXTURES_DIR, 'missing-manifest'));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('manifest.json not found');
  });
  
  it('rejects missing fragment file', () => {
    const result = validateWidget(join(FIXTURES_DIR, 'missing-fragment'));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Fragment file not found'))).toBe(true);
  });
});
