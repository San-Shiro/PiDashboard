import { describe, it, expect } from 'bun:test';
import { composeHTML } from '../../engine/compositor';
import { CanvasConfig, WidgetManifest } from '../../engine/schema';

describe('Compositor', () => {
  const mockRegistry = [
    {
      id: 'clock-analog',
      manifest: {
        id: 'clock-analog',
        name: 'Clock',
        version: '1.0',
        tier: 'static',
        trust: 'core',
        dataChannel: { type: 'none' },
        fragment: { file: 'clock.html', format: 'snippet' },
        resources: { externalFonts: ['Roboto'] }
      } as WidgetManifest,
      fragmentHTML: '<div class="clock"></div><script>PiWidget.register(document.currentScript.parentElement, function() {});</script>'
    },
    {
      id: 'community-weather',
      manifest: {
        id: 'community-weather',
        name: 'Weather',
        version: '1.0',
        tier: 'pull',
        trust: 'community',
        dataChannel: { type: 'none' },
        fragment: { file: 'weather.html', format: 'snippet' }
      } as WidgetManifest,
      fragmentHTML: '<div class="weather"></div>'
    }
  ];

  const mockCanvas: CanvasConfig = {
    schemaVersion: 2,
    id: 'test-canvas',
    name: 'Test Canvas',
    canvas: {
      width: 1920,
      height: 1080,
      background: '#0d1117',
      displayTarget: 'primary',
      pixelRatio: 1,
      fps: 60
    },
    widgets: [
      {
        id: 'w1',
        widget_id: 'clock-analog',
        label: 'Clock',
        enabled: true,
        layout: { x: 10, y: 10, width: 200, height: 200, zIndex: 2, opacity: 1, overflow: 'hidden' },
        config: { theme: 'dark' }
      },
      {
        id: 'w2',
        widget_id: 'community-weather',
        label: 'Weather',
        enabled: true,
        layout: { x: 300, y: 10, width: 400, height: 300, zIndex: 1, opacity: 0.8, overflow: 'hidden' },
        config: {}
      }
    ],
    updated_at: new Date().toISOString()
  };

  it('generates valid HTML document', () => {
    const html = composeHTML(mockCanvas, mockRegistry);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('renders widgets sorted by zIndex (lowest first in DOM)', () => {
    const html = composeHTML(mockCanvas, mockRegistry);
    const weatherIndex = html.indexOf('data-widget="community-weather"');
    const clockIndex = html.indexOf('data-widget="clock-analog"');
    
    // w2 (weather) has zIndex 1, w1 (clock) has zIndex 2
    expect(weatherIndex).toBeLessThan(clockIndex);
  });

  it('applies layout styles correctly (position, size, opacity)', () => {
    const html = composeHTML(mockCanvas, mockRegistry);
    expect(html).toContain('left: 10px; top: 10px; width: 200px; height: 200px; z-index: 2; opacity: 1');
  });

  it('embeds widget config as data-config attribute', () => {
    const html = composeHTML(mockCanvas, mockRegistry);
    expect(html).toContain('data-config=\'{&quot;theme&quot;:&quot;dark&quot;}\'');
  });

  it('wraps widget script in try/catch error boundary for core widgets', () => {
    const html = composeHTML(mockCanvas, mockRegistry);
    expect(html).toContain('try {');
    expect(html).toContain('catch(__err) {');
    expect(html).toContain('PiWidget.register');
  });

  it('injects PiWidget SDK script in head', () => {
    const html = composeHTML(mockCanvas, mockRegistry);
    expect(html).toContain('<script src="/media/libs/pi-widget-sdk.js"></script>');
  });

  it('injects Google Fonts for widgets that declare them', () => {
    const html = composeHTML(mockCanvas, mockRegistry);
    expect(html).toContain('fonts.googleapis.com/css2?family=Roboto&display=swap');
  });

  it('renders community widgets in sandboxed iframe', () => {
    const html = composeHTML(mockCanvas, mockRegistry);
    expect(html).toContain('<iframe sandbox="allow-scripts"');
    expect(html).toContain('var __WIDGET_CONFIG__ = {}'); // in srcdoc
  });

  it('generates client-side schedule checker script', () => {
    const html = composeHTML(mockCanvas, mockRegistry);
    expect(html).toContain('function scheduleLoop()');
  });

  it('handles empty canvas (no widgets)', () => {
    const emptyCanvas = { ...mockCanvas, widgets: [] };
    const html = composeHTML(emptyCanvas, mockRegistry);
    expect(html).toContain('id="kiosk-viewport"');
    expect(html).not.toContain('data-widget=');
  });

  it('handles disabled widgets (enabled=false, excluded from output)', () => {
    const disabledCanvas = {
      ...mockCanvas,
      widgets: [{ ...mockCanvas.widgets[0], enabled: false }]
    };
    const html = composeHTML(disabledCanvas, mockRegistry);
    expect(html).not.toContain('data-widget="clock-analog"');
  });
});
