import { describe, it, expect } from 'bun:test';
import { validateCanvas } from '../../engine/validators/canvas-validator';

const mockRegistry = ['clock-analog', 'weather', 'sysinfo'];

describe('Canvas Validator', () => {
  // ── Structure checks ──
  it('rejects null input', () => {
    const r = validateCanvas(null, mockRegistry);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Canvas must be a JSON object');
  });
  
  it('rejects missing canvas block', () => {
    const r = validateCanvas({ widgets: [] }, mockRegistry);
    expect(r.valid).toBe(false);
  });
  
  it('rejects missing widgets array', () => {
    const r = validateCanvas({ canvas: { width: 1920 } }, mockRegistry);
    expect(r.valid).toBe(false);
  });
  
  // ── Clamping ──
  it('clamps width to 320-7680', () => {
    const r = validateCanvas({
      canvas: { width: 100 }, widgets: []
    }, mockRegistry);
    expect(r.sanitized.canvas.width).toBe(320);
  });
  
  it('clamps height to 240-4320', () => {
    const r = validateCanvas({
      canvas: { height: 10000 }, widgets: []
    }, mockRegistry);
    expect(r.sanitized.canvas.height).toBe(4320);
  });
  
  it('defaults background to #0d1117', () => {
    const r = validateCanvas({
      canvas: { width: 1920 }, widgets: []
    }, mockRegistry);
    expect(r.sanitized.canvas.background).toBe('#0d1117');
  });
  
  it('defaults fps to 60', () => {
    const r = validateCanvas({
      canvas: { width: 1920, fps: 45 }, widgets: []
    }, mockRegistry);
    expect(r.sanitized.canvas.fps).toBe(60);
  });
  
  // ── Widget validation ──
  it('rejects widget with unknown widget_id', () => {
    const r = validateCanvas({
      canvas: { width: 1920, height: 1080 },
      widgets: [{ id: 'w1', widget_id: 'nonexistent', enabled: true, layout: {}, config: {} }]
    }, mockRegistry);
    expect(r.errors.some(e => e.includes('nonexistent'))).toBe(true);
    expect(r.sanitized.widgets.length).toBe(0);
  });
  
  it('rejects duplicate instance IDs', () => {
    const r = validateCanvas({
      canvas: { width: 1920, height: 1080 },
      widgets: [
        { id: 'w1', widget_id: 'clock-analog', enabled: true, layout: {}, config: {} },
        { id: 'w1', widget_id: 'weather', enabled: true, layout: {}, config: {} }
      ]
    }, mockRegistry);
    expect(r.sanitized.widgets.length).toBe(1);
  });
  
  it('clamps zIndex to 1-999', () => {
    const r = validateCanvas({
      canvas: { width: 1920, height: 1080 },
      widgets: [{ id: 'w1', widget_id: 'clock-analog', enabled: true, layout: { zIndex: 5000 }, config: {} }]
    }, mockRegistry);
    expect(r.sanitized.widgets[0].layout.zIndex).toBe(999);
  });
  
  it('strips invalid blendMode', () => {
    const r = validateCanvas({
      canvas: { width: 1920, height: 1080 },
      widgets: [{ id: 'w1', widget_id: 'clock-analog', enabled: true, layout: { blendMode: 'invalid' }, config: {} }]
    }, mockRegistry);
    expect(r.sanitized.widgets[0].layout.blendMode).toBeUndefined();
  });
  
  // ── Computed fields ──
  it('strips widget_count from input', () => {
    const r = validateCanvas({
      canvas: { width: 1920, height: 1080 },
      widgets: [],
      widget_count: 42
    }, mockRegistry);
    expect((r.sanitized as any).widget_count).toBeUndefined();
  });
  
  it('stamps schemaVersion 2', () => {
    const r = validateCanvas({
      canvas: { width: 1920, height: 1080 },
      widgets: []
    }, mockRegistry);
    expect(r.sanitized.schemaVersion).toBe(2);
  });
  
  // ── Schedule validation ──
  it('strips schedule with invalid time format', () => {
    const r = validateCanvas({
      canvas: { width: 1920, height: 1080 },
      widgets: [{
        id: 'w1', widget_id: 'clock-analog', enabled: true, layout: {},
        schedule: { activeFrom: '9am', activeTo: '5pm' },
        config: {}
      }]
    }, mockRegistry);
    expect(r.sanitized.widgets[0].schedule).toBeUndefined();
  });
  
  it('accepts valid midnight-wrap schedule', () => {
    const r = validateCanvas({
      canvas: { width: 1920, height: 1080 },
      widgets: [{
        id: 'w1', widget_id: 'clock-analog', enabled: true, layout: {},
        schedule: { activeFrom: '23:00', activeTo: '06:00' },
        config: {}
      }]
    }, mockRegistry);
    expect(r.sanitized.widgets[0].schedule?.activeFrom).toBe('23:00');
  });
  
  // ── NaN handling ──
  it('handles NaN in layout fields', () => {
    const r = validateCanvas({
      canvas: { width: 1920, height: 1080 },
      widgets: [{ id: 'w1', widget_id: 'clock-analog', enabled: true, layout: { x: NaN, opacity: NaN }, config: {} }]
    }, mockRegistry);
    expect(r.sanitized.widgets[0].layout.x).toBe(0);
    expect(r.sanitized.widgets[0].layout.opacity).toBe(0);
  });
});
