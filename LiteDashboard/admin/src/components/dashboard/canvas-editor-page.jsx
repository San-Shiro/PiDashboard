// Canvas Editor — full-screen layout editor for a specific canvas.
// Navigated to via /canvas/:canvasId/edit.
// Reads dimensions from the canvas itself — no hardcoded constants.
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWidgetVisuals } from "./widget-meta";
import { WidgetRenderer } from "./widget-renderers";
import useWidgetData from "./use-widget-data";
import WidgetEditPanel from "./widget-edit-panel";
import Icon from "./icon";
import {
  Card,
  Pill,
  SectionHeader,
  GhostButton,
  PrimaryButton,
  Spinner,
  FieldLabel,
} from "./ui-primitives";
import {
  ArrowLeft,
  Plus,
  Save,
  Grid3x3,
  Eye,
  Trash2,
  Monitor,
  PanelRight,
  PanelRightClose
} from "lucide-react";

function isWidgetActive(base) {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const current = `${h}:${m}`;
  if (!base.activeFrom || !base.activeTo) return true;
  if (base.activeFrom === "00:00" && base.activeTo === "23:59") return true;
  return current >= base.activeFrom && current <= base.activeTo;
}

function AddWidgetModal({ registry, onAdd, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ pointerEvents: "auto" }}
        onClick={onClose}
      />
      <div
        className="relative border rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        style={{
          pointerEvents: "auto",
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div
          className="sticky top-0 px-5 py-4 z-10"
          style={{
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <h3
            style={{ color: "var(--color-text-primary)" }}
            className="text-sm font-semibold"
          >
            Add a widget to this canvas
          </h3>
        </div>
        <div className="p-3">
          {registry.map((w) => {
            const visuals = getWidgetVisuals(w);
            return (
              <button
                key={w.id}
                onClick={() => {
                  onAdd(w.id);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-lg hover:bg-white/5 transition-colors flex items-start gap-3"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: visuals.bg }}
                >
                  <Icon
                    name={w.icon}
                    size={18}
                    style={{ color: visuals.color }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ color: "var(--color-text-primary)" }}
                      className="text-sm font-semibold"
                    >
                      {w.name}
                    </span>
                    <span
                      style={{ color: "var(--color-text-muted)" }}
                      className="text-xs font-mono"
                    >
                      v{w.version}
                    </span>
                  </div>
                  <p
                    style={{ color: "var(--color-text-secondary)" }}
                    className="text-xs mt-0.5"
                  >
                    {w.description}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    <Pill>{w.category}</Pill>
                    <Pill>{w.estimatedRamMb || 0} MB</Pill>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CanvasEditorShell() {
  const { canvasId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const containerRef = useRef(null);
  const [canvasPixelW, setCanvasPixelW] = useState(800);
  const [showGrid, setShowGrid] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingInstanceId, setEditingInstanceId] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [dirty, setDirty] = useState(false);
  const dragState = useRef(null);
  const wasDragged = useRef(false);

  // Tick clock for live preview
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch this canvas
  const {
    data: canvasData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["canvas", canvasId],
    queryFn: async () => {
      const r = await fetch(`/api/templates/${canvasId}`);
      if (!r.ok) throw new Error("Canvas not found");
      return r.json();
    },
  });

  // Fetch widget registry
  const { data: registryData } = useQuery({
    queryKey: ["widget-registry"],
    queryFn: async () => {
      const r = await fetch("/api/widgets/registry");
      if (!r.ok) throw new Error("registry");
      return r.json();
    },
  });

  // Fetch media list for file pickers (image widget etc.)
  const { data: mediaData } = useQuery({
    queryKey: ["media-files"],
    queryFn: async () => {
      const r = await fetch("/api/media");
      if (!r.ok) throw new Error("media");
      return r.json();
    },
  });

  const registry = registryData?.widgets || [];
  // API returns flat array; derive mime_type from extension for FileInput filtering
  const mediaFiles = (Array.isArray(mediaData) ? mediaData : []).map((f) => {
    const ext = (f.filename || "").split(".").pop()?.toLowerCase() || "";
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp", mp4: "video/mp4", webm: "video/webm" };
    return { ...f, id: f.filename, mime_type: mimeMap[ext] || "application/octet-stream" };
  });

  // Canvas dimensions from data
  const CANVAS_W = canvasData?.canvas_config?.width || canvasData?.width || 1920;
  const CANVAS_H =
    canvasData?.canvas_config?.height || canvasData?.height || 1080;
  const canvasName = canvasData?.name || canvasId;

  // Local mutable copy of widgets for optimistic edits
  const [localWidgets, setLocalWidgets] = useState([]);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (canvasData?.widgets && registry.length > 0 && !initializedRef.current) {
      // Only hydrate from server on first load — never overwrite local edits
      const hydrated = canvasData.widgets.map((inst) => {
        const manifest = registry.find((w) => w.id === inst.widget_id) || {};
        return { ...inst, manifest };
      });
      setLocalWidgets(hydrated);
      initializedRef.current = true;
    }
  }, [canvasData, registry]);

  // Responsive scaling
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setCanvasPixelW(Math.min(containerRef.current.clientWidth - 32, 1200));
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const scale = canvasPixelW / CANVAS_W;
  const canvasPixelH = CANVAS_H * scale;

  // Widget data for live preview
  const activeIds = Array.from(
    new Set(
      localWidgets.filter((i) => i.enabled).map((i) => i.widget_id)
    )
  );
  const widgetData = useWidgetData(showPreview ? activeIds : []);

  // Editing instance
  const editingInstance = useMemo(
    () => localWidgets.find((i) => i.id === editingInstanceId) || null,
    [localWidgets, editingInstanceId]
  );

  // ─── Drag & Drop ─────────────────────────────────────────────
  const startDrag = useCallback((e, instance, mode) => {
    e.preventDefault();
    e.stopPropagation();
    wasDragged.current = false;
    const l = instance.layout || {};
    dragState.current = {
      mode,
      instanceId: instance.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: l.x || 0,
      origY: l.y || 0,
      origW: l.width || 100,
      origH: l.height || 100,
    };
  }, []);

  const handleMove = useCallback(
    (e) => {
      const s = dragState.current;
      if (!s) return;
      const dx = (e.clientX - s.startX) / scale;
      const dy = (e.clientY - s.startY) / scale;
      
      if (Math.abs(e.clientX - s.startX) > 2 || Math.abs(e.clientY - s.startY) > 2) {
        wasDragged.current = true;
      }

      setLocalWidgets((prev) =>
        prev.map((inst) => {
          if (inst.id !== s.instanceId) return inst;
          const l = inst.layout || {};
          if (s.mode === "move") {
            return {
              ...inst,
              layout: {
                ...l,
                x: Math.max(
                  0,
                  Math.min(CANVAS_W - (l.width || 0), Math.round(s.origX + dx))
                ),
                y: Math.max(
                  0,
                  Math.min(
                    CANVAS_H - (l.height || 0),
                    Math.round(s.origY + dy)
                  )
                ),
              },
            };
          } else {
            return {
              ...inst,
              layout: {
                ...l,
                width: Math.max(
                  40,
                  Math.min(CANVAS_W - (l.x || 0), Math.round(s.origW + dx))
                ),
                height: Math.max(
                  30,
                  Math.min(CANVAS_H - (l.y || 0), Math.round(s.origH + dy))
                ),
              },
            };
          }
        })
      );
      setDirty(true);
    },
    [scale, CANVAS_W, CANVAS_H]
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

  // ─── Mutations ────────────────────────────────────────────────
  const addWidget = useMutation({
    mutationFn: async (widget_id) => {
      // Create local only instead of hitting an endpoint immediately
      const manifest = registry.find((w) => w.id === widget_id) || {};
      const newInst = {
        id: crypto.randomUUID(),
        widget_id,
        label: manifest.name || "New Widget",
        enabled: true,
        layout: {
          x: 20, y: 20, width: manifest.defaults?.width || 200, height: manifest.defaults?.height || 200,
          zIndex: localWidgets.length + 1, opacity: 1, overflow: "hidden"
        },
        config: {},
        manifest
      };
      return newInst;
    },
    onSuccess: (newInst) => {
      setLocalWidgets((prev) => [...prev, newInst]);
      setDirty(true);
    },
  });

  const saveCanvas = useMutation({
    mutationFn: async () => {
      // Strip manifests before saving
      const cleanWidgets = localWidgets.map(({ manifest, ...rest }) => rest);
      const payload = {
        ...canvasData,
        widgets: cleanWidgets,
        widget_count: cleanWidgets.length,
      };
      delete payload.id;
      const r = await fetch(`/api/templates/${canvasId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("save");
      return r.json();
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["canvas", canvasId] });
    },
  });

  const deleteWidget = useCallback(
    (instanceId) => {
      setLocalWidgets((prev) => prev.filter((w) => w.id !== instanceId));
      setDirty(true);
      setEditingInstanceId(null);
    },
    []
  );

  const updateWidgetLocal = useCallback((changes) => {
    setEditingInstanceId((currentId) => {
      setLocalWidgets((prev) =>
        prev.map((inst) => {
          if (inst.id !== currentId) return inst;
          return {
            ...inst,
            label: changes.label !== undefined ? changes.label : inst.label,
            enabled:
              changes.enabled !== undefined ? changes.enabled : inst.enabled,
            layout: changes.layout
              ? { ...inst.layout, ...changes.layout }
              : inst.layout,
            config: changes.config
              ? { ...inst.config, ...changes.config }
              : inst.config,
          };
        })
      );
      setDirty(true);
      return currentId;
    });
  }, []);

  // Snap to grid
  const snapAll = useCallback(() => {
    setLocalWidgets((prev) =>
      prev.map((inst) => {
        const l = inst.layout || {};
        const grid = 20;
        return {
          ...inst,
          layout: {
            ...l,
            x: Math.round((l.x || 0) / grid) * grid,
            y: Math.round((l.y || 0) / grid) * grid,
            width: Math.round((l.width || 0) / grid) * grid,
            height: Math.round((l.height || 0) / grid) * grid,
          },
        };
      })
    );
    setDirty(true);
  }, []);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <Spinner size={24} />
      </div>
    );
  }

  if (error || !canvasData) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <p style={{ color: "var(--color-text-secondary)" }}>
          Canvas not found.
        </p>
        <GhostButton onClick={() => navigate("/")}>
          <ArrowLeft size={14} />
          Back to dashboard
        </GhostButton>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col font-inter"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>

      {/* Header bar */}
      <header
        className="px-6 py-3 flex items-center justify-between sticky top-0 z-40 border-b shadow-sm"
        style={{
          backgroundColor: "var(--color-header-bg)",
          borderColor: "var(--color-header-border)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => {
              if (dirty && !window.confirm("You have unsaved changes. Leave anyway?")) return;
              navigate("/");
            }}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1
                className="text-sm font-bold truncate"
                style={{ color: "var(--color-text-primary)" }}
              >
                {canvasName}
              </h1>
              <Pill>
                <Monitor size={10} />
                {CANVAS_W} × {CANVAS_H}
              </Pill>
              {dirty && (
                <Pill tone="amber">Unsaved changes</Pill>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            Preview
          </button>
          <button
            onClick={() => setShowAddWidget(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "#FFFFFF",
            }}
          >
            <Plus size={14} />
            Add widget
          </button>
          <GhostButton onClick={snapAll}>
            <Grid3x3 size={10} />
            Snap all
          </GhostButton>
          <PrimaryButton
            onClick={() => saveCanvas.mutate()}
            disabled={saveCanvas.isPending || !dirty}
          >
            {saveCanvas.isPending ? <Spinner size={12} /> : <Save size={12} />}
            Save canvas
          </PrimaryButton>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas area */}
        <main
          className="flex-1 flex items-start justify-center p-6 overflow-auto animate-fade-in relative"
          ref={containerRef}
        >
        <div
          className="relative rounded-xl overflow-hidden select-none border shadow-2xl"
          style={{
            width: canvasPixelW,
            height: canvasPixelH,
            backgroundColor:
              canvasData?.canvas_config?.background ||
              canvasData?.background ||
              "#0a0a0a",
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

          {/* Widgets */}
          {localWidgets.map((inst) => {
            const layout = inst.layout || {};
            const manifest = inst.manifest || {};
            const visuals = getWidgetVisuals(manifest);
            // Ignore schedules for now in preview mode so we can always edit them
            const active = inst.enabled;
            const isEditing = inst.id === editingInstanceId;

            return (
              <div
                key={inst.id}
                onMouseDown={(e) => startDrag(e, inst, "move")}
                onClick={(e) => {
                  if (!wasDragged.current) {
                    setEditingInstanceId(inst.id);
                    setSidebarOpen(true);
                  }
                }}
                style={{
                  position: "absolute",
                  left: (layout.x || 0) * scale,
                  top: (layout.y || 0) * scale,
                  width: (layout.width || 100) * scale,
                  height: (layout.height || 100) * scale,
                  opacity: active ? (layout.opacity ?? 1) : 0.3,
                  zIndex: layout.zIndex || 1,
                  cursor: "move",
                  border: `${isEditing ? 2 : 1}px solid ${
                    isEditing
                      ? "var(--color-accent)"
                      : inst.enabled
                      ? visuals.color
                      : "#444"
                  }`,
                  borderRadius: layout.borderRadius || 3,
                  overflow: layout.overflow || "hidden",
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

                {/* Resize handle */}
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

          {/* Canvas dimension label */}
          <div
            className="absolute bottom-2 right-3 text-[10px] font-mono pointer-events-none"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            {CANVAS_W} × {CANVAS_H} · {Math.round(scale * 100)}% ·{" "}
            {localWidgets.length} widgets
          </div>
        </div>
      </main>

      {/* Floating Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="absolute z-30 top-1/2 -translate-y-1/2 flex items-center justify-center shadow-md transition-all hover:brightness-110"
        style={{ 
          right: sidebarOpen ? "20rem" : "0", 
          width: 24, 
          height: 48, 
          borderTopLeftRadius: 8, 
          borderBottomLeftRadius: 8,
          border: "1px solid var(--color-border)",
          borderRight: "none",
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text-secondary)"
        }}
        title="Toggle Sidebar"
      >
        {sidebarOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
      </button>

      {/* Sidebar Area */}
      <div 
        className="shrink-0 z-20 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden shadow-xl"
        style={{ 
          width: sidebarOpen ? "20rem" : "0px",
          opacity: sidebarOpen ? 1 : 0
        }}
      >
        <aside 
          className="w-80 h-full border-l flex flex-col"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          {editingInstance ? (
            <WidgetEditPanel
              instance={editingInstance}
              canvasW={CANVAS_W}
              canvasH={CANVAS_H}
              mediaFiles={mediaFiles}
              onUpdateInstance={updateWidgetLocal}
              onDeleteInstance={() => deleteWidget(editingInstanceId)}
              onClose={() => setEditingInstanceId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in opacity-50">
              <Monitor size={32} style={{ color: "var(--color-text-secondary)" }} className="mb-3" />
              <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Canvas Editor</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                Click on any widget to view and edit its properties here.
              </p>
            </div>
          )}
        </aside>
      </div>
      </div>

      {/* Add widget modal */}
      {showAddWidget && (
        <AddWidgetModal
          registry={registry}
          onAdd={(wid) => addWidget.mutate(wid)}
          onClose={() => setShowAddWidget(false)}
        />
      )}
    </div>
  );
}

export default function CanvasEditorPage() {
  return <CanvasEditorShell />;
}
