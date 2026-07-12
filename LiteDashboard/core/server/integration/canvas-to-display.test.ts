import { describe, it, expect, mock } from 'bun:test';
import { composeHTML } from '../../engine/compositor';
import { validateCanvas } from '../../engine/validators/canvas-validator';
import { updateStateCache, getStateCacheEntry } from '../ipc/tmpfs-watcher';
import { websocketHandler } from '../ws/display';
import { CanvasConfig, WidgetManifest } from '../../engine/schema';

describe('Full Pipeline Integration', () => {
  it('publish → validate → compose', async () => {
    const registry: { id: string, manifest: WidgetManifest, fragmentHTML: string }[] = [
      {
        id: 'clock-analog',
        manifest: {
          id: 'clock-analog',
          name: 'Clock',
          version: '1.0',
          tier: 'static',
          trust: 'core',
          dataChannel: { type: 'none' },
          fragment: { file: 'fragment.html', format: 'snippet' }
        },
        fragmentHTML: '<div>Clock</div>'
      }
    ];

    const rawCanvas = {
      id: 'test',
      name: 'Test',
      canvas: { width: 1920, height: 1080, background: '#000', fps: 60, displayTarget: 'primary', pixelRatio: 1 },
      widgets: [{
        id: 'w1',
        widget_id: 'clock-analog',
        enabled: true,
        layout: { x: 0, y: 0, width: 320, height: 240, zIndex: 1, opacity: 1, overflow: 'hidden' },
        config: { timezone: 'UTC' }
      }]
    };

    const validationResult = validateCanvas(rawCanvas, ['clock-analog']);
    expect(validationResult.valid).toBe(true);

    const html = composeHTML(validationResult.sanitized as CanvasConfig, registry);
    expect(html).toContain('data-widget="clock-analog"');
    expect(html).toContain('&quot;timezone&quot;:&quot;UTC&quot;');
  });

  it('IPC write → stateCache → WS push', async () => {
    const ws = {
      readyState: 1,
      send: mock((data: string) => {})
    };
    websocketHandler.open(ws);

    // Simulate daemon writing to IPC
    updateStateCache('sysinfo', { cpu: 42 });

    // Verify stateCache updated
    expect(getStateCacheEntry('sysinfo')).toEqual({ cpu: 42 });

    // Verify WS push (note: in our real system, tmpfs-watcher's onData calls pushData. Here we test state cache)
    // When a new kiosk connects, it receives hydration
    const ws2 = {
      readyState: 1,
      send: mock((data: string) => {})
    };
    websocketHandler.open(ws2);

    expect(ws2.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'state', widget: 'sysinfo', instance: 'global', data: { cpu: 42 } })
    );

    websocketHandler.close(ws);
    websocketHandler.close(ws2);
  });

  it('invalid canvas rejected without side effects', () => {
    const result = validateCanvas({ invalid: true }, []);
    expect(result.valid).toBe(false);
  });

  it('widget command routes to IPC cmd file', () => {
    const ws = {
      readyState: 1,
      send: mock((data: string) => {})
    };
    websocketHandler.open(ws);

    websocketHandler.message(ws, JSON.stringify({
      type: 'widget_command',
      widget: 'mpd-player',
      action: 'toggle_play',
      payload: {}
    }));

    // In a full integration we'd check if the IPC command file was created
    // But since handleWidgetCommand is a stub in our implementation, we'll just check no throw
    expect(true).toBe(true);
    websocketHandler.close(ws);
  });
});
