// Interactive 1280×720 canvas with drag-and-drop positioning and live widget previews.
// Drag a widget body → moves it. Drag the bottom-right corner → resizes it.
import { useRef, useState, useEffect, useCallback } from "react";
import Icon from "../icon";
import { Pill, SectionHeader, GhostButton } from "../ui-primitives";
import { WidgetRenderer } from "../widget-renderers";
import { getWidgetVisuals, CANVAS_W, CANVAS_H } from "../widget-meta";
import useWidgetData from "../use-widget-data";
import { LayoutGrid, Grid3x3, Eye } from "lucide-react";

function isWidgetActive(base) {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const current = `${h}:${m}`;
  if (!base.activeFrom || !base.activeTo) return true;
  if (base.activeFrom === "00:00" && base.activeTo === "23:59") return true;
  return current >= base.activeFrom && current <= base.activeTo;
}

export default function LayoutTab({
  instances,
  registry,
  onUpdateInstance,
  onSelectInstance,
}) {
  const containerRef = useRef(null);
  const [canvasW, setCanvasW] = useState(800);
  const [showGrid, setShowGrid] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [now, setNow] = useState(() => new Date());

  // Tick clock + image refresh
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Drag state
  const dragState = useRef(null);

  // Responsive scaling
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setCanvasW(Math.min(containerRef.current.clientWidth, 1100));
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const scale = canvasW / CANVAS_W;
  const canvasH = CANVAS_H * scale;

  // Build widget data list for polling
  const activeIds = Array.from(
    new Set(instances.filter((i) => i.enabled).map((i) => i.widget_id)),
  );
  const widgetData = useWidgetData(showPreview ? activeIds : []);

  const startDrag = useCallback((e, instance, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const base = instance.base_config || {};
    dragState.current = {
      mode,
      instanceId: instance.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: base.x,
      origY: base.y,
      origW: base.width,
      origH: base.height,
    };
  }, []);

  const handleMove = useCallback(
    (e) => {
      const s = dragState.current;
      if (!s) return;
      const dx = (e.clientX - s.startX) / scale;
      const dy = (e.clientY - s.startY) / scale;
      const inst = instances.find((i) => i.id === s.instanceId);
      if (!inst) return;

      if (s.mode === "move") {
        const newX = Math.max(
          0,
          Math.min(
            CANVAS_W - (inst.base_config.width || 0),
            Math.round(s.origX + dx),
          ),
        );
        const newY = Math.max(
          0,
          Math.min(
            CANVAS_H - (inst.base_config.height || 0),
            Math.round(s.origY + dy),
          ),
        );
        onUpdateInstance(s.instanceId, {
          base_config: { ...inst.base_config, x: newX, y: newY },
        });
      } else if (s.mode === "resize") {
        const newW = Math.max(
          40,
          Math.min(CANVAS_W - inst.base_config.x, Math.round(s.origW + dx)),
        );
        const newH = Math.max(
          30,
          Math.min(CANVAS_H - inst.base_config.y, Math.round(s.origH + dy)),
        );
        onUpdateInstance(s.instanceId, {
          base_config: { ...inst.base_config, width: newW, height: newH },
        });
      }
    },
    [instances, onUpdateInstance, scale],
  );

  const endDrag = useCallback(() => {
    dragState.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", endDrag);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", endDrag);
    };
  }, [handleMove, endDrag]);

  // Snap-to-grid helpers
  const snapToGrid = useCallback(
    (id) => {
      const inst = instances.find((i) => i.id === id);
      if (!inst) return;
      const grid = 20;
      const b = inst.base_config;
      onUpdateInstance(id, {
        base_config: {
          ...b,
          x: Math.round(b.x / grid) * grid,
          y: Math.round(b.y / grid) * grid,
          width: Math.round(b.width / grid) * grid,
          height: Math.round(b.height / grid) * grid,
        },
      });
    },
    [instances, onUpdateInstance],
  );

  return (
    <div>
      <SectionHeader
        title="Layout Editor"
        subtitle="Drag widgets to reposition · drag the corner to resize · click to edit."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGrid((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors"
              style={{
                backgroundColor: showGrid
                  ? "var(--color-accent-bg)"
                  : "transparent",
                borderColor: showGrid
                  ? "var(--color-accent)"
                  : "var(--color-border)",
                color: showGrid
                  ? "var(--color-accent)"
                  : "var(--color-text-secondary)",
              }}
            >
              <Grid3x3 size={12} />
              Grid
            </button>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors"
              style={{
                backgroundColor: showPreview
                  ? "var(--color-accent-bg)"
                  : "transparent",
                borderColor: showPreview
                  ? "var(--color-accent)"
                  : "var(--color-border)",
                color: showPreview
                  ? "var(--color-accent)"
                  : "var(--color-text-secondary)",
              }}
            >
              <Eye size={12} />
              Live preview
            </button>
          </div>
        }
      />

      <div ref={containerRef} className="w-full">
        <div
          className="relative rounded-xl overflow-hidden select-none border"
          style={{
            width: canvasW,
            height: canvasH,
            backgroundColor: "#0a0a0a",
            borderColor: "var(--color-border)",
          }}
        >
          {/* Grid lines */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: `${80 * scale}px ${80 * scale}px`,
              }}
            />
          )}

          {instances.map((inst) => {
            const base = inst.base_config || {};
            const manifest = inst.manifest || {};
            const visuals = getWidgetVisuals(manifest);
            const active = inst.enabled && isWidgetActive(base);

            return (
              <div
                key={inst.id}
                onMouseDown={(e) => startDrag(e, inst, "move")}
                onClick={(e) => {
                  if (!dragState.current) onSelectInstance(inst);
                }}
                style={{
                  position: "absolute",
                  left: base.x * scale,
                  top: base.y * scale,
                  width: base.width * scale,
                  height: base.height * scale,
                  opacity: active ? (base.opacity ?? 1) : 0.3,
                  zIndex: base.zIndex,
                  cursor: "move",
                  border: `1px solid ${inst.enabled ? visuals.color : "#444"}`,
                  borderRadius: 3,
                  overflow: "hidden",
                  backgroundColor: showPreview
                    ? "transparent"
                    : `${visuals.color}22`,
                }}
                className="hover:brightness-110 group"
              >
                {showPreview ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      overflow: "hidden",
                      padding: 4,
                    }}
                  >
                    <div
                      style={{
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                        width: (1 / scale) * 100 + "%",
                        height: (1 / scale) * 100 + "%",
                      }}
                    >
                      <WidgetRenderer
                        instance={inst}
                        widgetData={widgetData}
                        now={now}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: visuals.color,
                      fontSize: Math.max(10, 12 * scale),
                      fontWeight: 500,
                      padding: 4,
                      textAlign: "center",
                    }}
                  >
                    {inst.label}
                  </div>
                )}

                <div
                  onMouseDown={(e) => startDrag(e, inst, "resize")}
                  className="absolute right-0 bottom-0 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: visuals.color,
                    borderTopLeftRadius: 4,
                  }}
                  title="Drag to resize"
                />
              </div>
            );
          })}

          <div
            className="absolute bottom-2 right-3 text-[10px] font-mono pointer-events-none"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {CANVAS_W} × {CANVAS_H} · {Math.round(scale * 100)}%
          </div>
        </div>
      </div>

      {/* Quick alignment toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span style={{ color: "var(--color-text-muted)" }}>Quick actions:</span>
        {
          instances
            .map((inst) => (
              <GhostButton key={inst.id} onClick={() => snapToGrid(inst.id)}>
                <Grid3x3 size={10} />
                Snap "{inst.label}" to 20px grid
              </GhostButton>
            ))
            .slice(0, 0) /* hide bulk row, keep below */
        }
        <button
          onClick={() => instances.forEach((i) => snapToGrid(i.id))}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors border"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          <Grid3x3 size={10} />
          Snap all to grid
        </button>
      </div>
    </div>
  );
}
