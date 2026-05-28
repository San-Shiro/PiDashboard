import { describe, it, expect } from "bun:test";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { composeHTML, cacheWidgetFragments } from "./compose";

const ACTIVE_PATH = join(process.cwd(), "canvases", "active.json");

describe("Dynamic HTML Compositor Core", () => {
  it("should cache widget fragments dynamically in RAM", () => {
    // Execution checks that fragment caching doesn't throw exceptions
    expect(() => cacheWidgetFragments()).not.toThrow();
  });

  it("should successfully compile valid markup layout containers", () => {
    // Write a mock layout to canvases/active.json for verification
    const mockCanvas = {
      name: "Mock Display",
      width: 1280,
      height: 720,
      widgets: [
        {
          widgetId: "clock",
          position: { x: 50, y: 80, w: 200, h: 100, z: 5, o: 0.9 },
          config: { showSeconds: true }
        }
      ]
    };

    writeFileSync(ACTIVE_PATH, JSON.stringify(mockCanvas, null, 2), "utf8");

    const html = composeHTML();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("kiosk-viewport");
    expect(html).toContain("canvas-container");
    expect(html).toContain("data-width=\"1280\"");
    expect(html).toContain("data-height=\"720\"");
    
    // Absolute position wrappers validation
    expect(html).toContain("data-widget=\"clock\"");
    expect(html).toContain("left: 50px");
    expect(html).toContain("top: 80px");
    expect(html).toContain("width: 200px");
    expect(html).toContain("height: 100px");
    expect(html).toContain("z-index: 5");
    expect(html).toContain("opacity: 0.9");
    expect(html).toContain("showSeconds");

    // Clean up mock
    if (existsSync(ACTIVE_PATH)) {
      unlinkSync(ACTIVE_PATH);
    }
  });
});
