# 13 — Testing Harness

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `*.test.ts`, `core/tools/`

---

## 6-Layer Test Architecture

```
Layer 1: Canvas Validator        ─ Pure logic, no I/O
Layer 2: Widget Validator        ─ File system reads (fixture dirs)
Layer 3: Compositor Output       ─ HTML string generation
Layer 4: IPC Pipeline            ─ fs.watch, stateCache, file I/O
Layer 5: WebSocket Pipeline      ─ Mock WS, broadcast, heartbeat
Layer 6: Full Integration        ─ Config → IPC → WS → display cycle
```

---

## Layer 1: Canvas Validator Tests

**File:** `core/server/schemas/canvas-validator.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';
import { validateCanvas } from './canvas-validator';

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
    expect(r.sanitized.widget_count).toBeUndefined();
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
    expect(r.sanitized.widgets[0].schedule.activeFrom).toBe('23:00');
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
```

---

## Layer 2: Widget Validator Tests

**File:** `core/server/sdk/widget-validator.test.ts`

Uses fixture directories:

```
core/test-fixtures/widgets/
  valid-static/
    manifest.json
    fragment/valid-static.html
  invalid-doctype/
    manifest.json
    fragment/invalid-doctype.html     ← Contains <!DOCTYPE html>
  invalid-eval/
    manifest.json                     ← trust: "verified"
    fragment/invalid-eval.html        ← Contains eval()
  valid-core-eval/
    manifest.json                     ← trust: "core"
    fragment/valid-core-eval.html     ← Contains eval() (allowed for core)
  missing-manifest/
    fragment/widget.html              ← No manifest.json
  missing-fragment/
    manifest.json                     ← fragment.file points to nonexistent file
```

```typescript
describe('Widget Validator', () => {
  it('accepts valid static widget');
  it('rejects fragment containing <!DOCTYPE html>');
  it('rejects fragment containing <html> tag');
  it('rejects fragment containing <head> tag');
  it('rejects fragment containing <body> tag');
  it('rejects verified widget containing eval()');
  it('accepts core widget containing eval()');
  it('rejects missing manifest.json');
  it('rejects missing fragment file');
  it('rejects manifest with invalid tier');
  it('rejects pull widget without fetchModule');
  it('rejects push widget without ipcFilename');
  it('warns when fragment exceeds 50KB');
  it('rejects when fragment exceeds 100KB');
  it('warns when PiWidget.register not found');
  it('rejects base64 image > 10KB in fragment');
  it('rejects when id does not match folder name');
});
```

---

## Layer 3: Compositor Tests

**File:** `core/server/compositor/compose.test.ts`

```typescript
describe('Compositor', () => {
  const mockRegistry = [/* manifests with fragments */];
  
  it('generates valid HTML document');
  it('renders widgets sorted by zIndex (lowest first in DOM)');
  it('applies layout styles correctly (position, size, opacity)');
  it('serializes filter object to CSS string');
  it('embeds widget config as data-config attribute');
  it('wraps widget script in try/catch error boundary');
  it('injects PiWidget SDK script in head');
  it('injects Lottie script only when needed');
  it('does NOT inject Lottie when no widget uses it');
  it('injects Google Fonts for widgets that declare them');
  it('renders community widgets in sandboxed iframe');
  it('embeds saved state as data-state attribute');
  it('includes schedule data as data-schedule attribute');
  it('generates client-side schedule checker script');
  it('generates WebSocket client script');
  it('generates heartbeat script');
  it('escapes special characters in data-config');
  it('handles empty canvas (no widgets)');
  it('handles disabled widgets (enabled=false, excluded from output)');
});
```

---

## Layer 4: IPC Pipeline Tests

**File:** `core/server/ipc/tmpfs-watcher.test.ts`

```typescript
import { mkdtempSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('IPC Pipeline', () => {
  let ipcDir: string;
  
  beforeEach(() => {
    ipcDir = mkdtempSync(join(tmpdir(), 'ipc-test-'));
  });
  
  it('detects new JSON file', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'sysinfo.json'), '{"cpu":42}');
    await sleep(200); // Debounce + read
    
    expect(received.length).toBe(1);
    expect(received[0].type).toBe('sysinfo');
    expect(received[0].data.cpu).toBe(42);
  });
  
  it('debounces rapid writes to same file', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    // Write 5 times in 50ms
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(ipcDir, 'sysinfo.json'), JSON.stringify({ cpu: i }));
      await sleep(10);
    }
    
    await sleep(200);
    
    // Should have fired once (or possibly twice depending on timing)
    expect(received.length).toBeLessThanOrEqual(2);
    expect(received[received.length - 1].data.cpu).toBe(4); // Last value
  });
  
  it('handles separate files independently', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'sysinfo.json'), '{"cpu":1}');
    writeFileSync(join(ipcDir, 'weather.json'), '{"temp":32}');
    await sleep(200);
    
    expect(received.length).toBe(2);
    expect(received.map(r => r.type).sort()).toEqual(['sysinfo', 'weather']);
  });
  
  it('ignores .cmd.json files', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'mpd.cmd.json'), '{"action":"play"}');
    await sleep(200);
    
    expect(received.length).toBe(0);
  });
  
  it('ignores non-JSON files', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'readme.txt'), 'hello');
    await sleep(200);
    
    expect(received.length).toBe(0);
  });
  
  it('handles corrupted JSON without crashing', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'broken.json'), 'not json{{{');
    await sleep(200);
    
    expect(received.length).toBe(0); // Skipped, no crash
  });
  
  it('handles empty file without crashing', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'empty.json'), '');
    await sleep(200);
    
    expect(received.length).toBe(0);
  });
  
  it('handles file deletion without crashing', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    const path = join(ipcDir, 'temp.json');
    writeFileSync(path, '{"val":1}');
    await sleep(200);
    
    unlinkSync(path);
    await sleep(200);
    
    // Should have received once, no crash on delete
    expect(received.length).toBe(1);
  });
  
  it('updates stateCache on change', async () => {
    startIpcWatcher(ipcDir, (type, data) => updateStateCache(type, data));
    
    writeFileSync(join(ipcDir, 'weather.json'), '{"temp":25}');
    await sleep(200);
    
    expect(getStateCacheEntry('weather')).toEqual({ temp: 25 });
  });
});
```

---

## Layer 5: WebSocket Pipeline Tests

**File:** `core/server/ws/display.test.ts`

```typescript
describe('WebSocket Pipeline', () => {
  // Use mock WebSocket objects
  function mockWs(readyState = 1) {
    return {
      readyState,
      send: mock(() => {}),
      data: {} // Bun WS data store
    };
  }
  
  it('pushData sends to all connected kiosks', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    kiosks.add(ws1);
    kiosks.add(ws2);
    
    pushData('weather', { temp: 32 });
    
    const expected = JSON.stringify({ type: 'data', widget: 'weather', data: { temp: 32 } });
    expect(ws1.send).toHaveBeenCalledWith(expected);
    expect(ws2.send).toHaveBeenCalledWith(expected);
  });
  
  it('skips closed connections', () => {
    const wsOpen = mockWs(1);
    const wsClosed = mockWs(3);  // CLOSED
    kiosks.add(wsOpen);
    kiosks.add(wsClosed);
    
    pushData('sysinfo', { cpu: 18 });
    
    expect(wsOpen.send).toHaveBeenCalled();
    expect(wsClosed.send).not.toHaveBeenCalled();
  });
  
  it('state hydration sends all cached data on connect', () => {
    updateStateCache('weather', { temp: 32 });
    updateStateCache('sysinfo', { cpu: 18 });
    
    const ws = mockWs();
    // Simulate open handler
    handleOpen(ws);
    
    expect(ws.send).toHaveBeenCalledTimes(2);
  });
  
  it('pushReload sends reload to all kiosks', () => {
    const ws = mockWs();
    kiosks.add(ws);
    
    pushReload();
    
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'reload' }));
  });
  
  it('handles heartbeat message', () => {
    const ws = mockWs();
    handleMessage(ws, JSON.stringify({
      type: 'heartbeat',
      canvas_id: 'test',
      uptime: 3600,
      widget_errors: 0,
      timestamp: Date.now()
    }));
    
    const statuses = getDisplayStatuses();
    expect(statuses.length).toBe(1);
    expect(statuses[0].canvasId).toBe('test');
    expect(statuses[0].status).toBe('online');
  });
  
  it('survives invalid JSON message', () => {
    const ws = mockWs();
    expect(() => handleMessage(ws, 'not json')).not.toThrow();
  });
  
  it('removes dead connections on send error', () => {
    const ws = mockWs();
    ws.send = mock(() => { throw new Error('dead'); });
    kiosks.add(ws);
    
    pushData('weather', { temp: 32 });
    
    expect(kiosks.has(ws)).toBe(false);
  });
});
```

---

## Layer 6: Full Integration Tests

**File:** `core/server/integration/canvas-to-display.test.ts`

```typescript
describe('Full Pipeline', () => {
  it('publish → validate → compose → reload', async () => {
    // Setup: register widgets, connect a mock kiosk
    const registry = registerTestWidgets(['clock-analog']);
    const ws = connectMockKiosk();
    
    // Publish a canvas
    const result = publishCanvas({
      id: 'test', name: 'Test',
      canvas: { width: 1920, height: 1080, background: '#000', fps: 60 },
      widgets: [{
        id: 'w1', widget_id: 'clock-analog', enabled: true,
        layout: { x: 0, y: 0, width: 320, height: 240, zIndex: 1, opacity: 1 },
        config: { timezone: 'UTC' }
      }]
    });
    
    expect(result.ok).toBe(true);
    
    // Verify HTML was generated
    const html = composeHTML(getActiveCanvas(), registry);
    expect(html).toContain('data-widget="clock-analog"');
    expect(html).toContain('"timezone":"UTC"');
    
    // Verify reload was sent
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'reload' }));
  });
  
  it('IPC write → stateCache → WS push', async () => {
    const ws = connectMockKiosk();
    
    // Simulate daemon writing to IPC
    writeFileSync(join(ipcDir, 'sysinfo.json'), '{"cpu":42}');
    await sleep(200);
    
    // Verify stateCache updated
    expect(getStateCacheEntry('sysinfo')).toEqual({ cpu: 42 });
    
    // Verify WS push sent
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'data', widget: 'sysinfo', data: { cpu: 42 } })
    );
  });
  
  it('invalid canvas rejected without side effects', () => {
    const result = publishCanvas({ invalid: true });
    expect(result.ok).toBe(false);
    // Active canvas unchanged
  });
  
  it('widget command routes to IPC cmd file', () => {
    handleMessage(mockWs(), JSON.stringify({
      type: 'widget_command',
      widget: 'mpd-player',
      action: 'toggle_play',
      payload: {}
    }));
    
    const cmdFile = join(ipcDir, 'mpd-player.cmd.json');
    expect(existsSync(cmdFile)).toBe(true);
    expect(JSON.parse(readFileSync(cmdFile, 'utf8')).action).toBe('toggle_play');
  });
});
```

---

## CLI Tools

### `core/tools/validate-widgets.ts`

```bash
bun run core/tools/validate-widgets.ts
# Output:
# ✓ clock-analog: OK
# ✗ bad-widget: REJECTED
#     ✗ Fragment contains <!DOCTYPE html>
# 1 passed, 1 failed
```

### `core/tools/validate-canvas.ts`

```bash
bun run core/tools/validate-canvas.ts --canvas canvases/active.json
# Output:
# ✓ Canvas valid (2 warnings)
#     ⚠ Width 800 clamped to 320 minimum
#     ⚠ Widget 'w3' blendMode 'typo' stripped
```

### `core/tools/canvas-preview.ts`

```bash
bun run core/tools/canvas-preview.ts --canvas canvases/saved/morning.json --output /tmp/preview.html
# Generates composited HTML without running the server
# Open in browser to preview widget layout
```

---

## Running Tests

```bash
# All tests
bun test

# Specific layer
bun test core/server/schemas/canvas-validator.test.ts
bun test core/server/sdk/widget-validator.test.ts
bun test core/server/compositor/compose.test.ts
bun test core/server/ipc/tmpfs-watcher.test.ts
bun test core/server/ws/display.test.ts
bun test core/server/integration/

# Watch mode (re-run on file changes)
bun test --watch
```

---

## Code Reminders

- **IPC tests need real temp directories.** Use `mkdtempSync` for isolated test dirs. Clean up in `afterEach`.
- **WS tests use mock objects, not real sockets.** Bun's `ServerWebSocket` can't be easily mocked — create simple objects with `send` and `readyState` properties.
- **Timing-sensitive tests (IPC debounce) need `await sleep()`.** The debounce is 100ms, so wait 200ms to be safe. Add generous margins for CI.
- **Widget validator tests need fixture files.** Create a `test-fixtures/widgets/` directory with valid and invalid widget packages. Don't use production widget dirs.
- **Integration tests should reset global state** (kiosks set, stateCache, activeCanvas) in `beforeEach`.
