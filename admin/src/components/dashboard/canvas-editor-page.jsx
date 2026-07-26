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
import LogsViewer from "./logs-viewer";
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
  PanelRightClose,
  Settings,
  Palette,
  X,
  Check,
  Terminal
} from "lucide-react";
import { CANVAS_THEMES, THEME_VAR_KEYS, DEFAULT_THEME, ensureThemeVars, CANVAS_TOKEN_GROUPS } from "@/data/canvas-themes";
import { CompactColorSwatch } from "./controls";
import {
  normalizeRuntimeTier,
  getWidgetRuntimeTier,
  allowsTier,
  loadSelectedRuntimeTier,
  saveSelectedRuntimeTier,
} from "./runtime-tier";

function isWidgetActive(base) {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const current = `${h}:${m}`;
  if (!base.activeFrom || !base.activeTo) return true;
  if (base.activeFrom === "00:00" && base.activeTo === "23:59") return true;
  return current >= base.activeFrom && current <= base.activeTo;
}

const DIMENSION_PRESETS = [
  { label: '1920 × 1080 (Full HD)', w: 1920, h: 1080 },
  { label: '1280 × 720 (HD)', w: 1280, h: 720 },
  { label: '800 × 480 (Pi Touch)', w: 800, h: 480 },
  { label: '3840 × 2160 (4K)', w: 3840, h: 2160 },
  { label: '1024 × 600 (7" Display)', w: 1024, h: 600 },
];

function CanvasSettingsModal({ canvasData, onSave, onClose }) {
  const cc = canvasData?.canvas_config || {};
  const [width, setWidth] = useState(cc.width || 1920);
  const [height, setHeight] = useState(cc.height || 1080);
  const [bg, setBg] = useState(cc.background || '#0a0a0a');
  const [name, setName] = useState(canvasData?.name || '');
  const [themeTab, setThemeTab] = useState('presets');
  
  // Theme state
  const currentTheme = cc.theme || DEFAULT_THEME;
  const [selectedThemeId, setSelectedThemeId] = useState(currentTheme.id || 'midnight');
  const [customVars, setCustomVars] = useState(ensureThemeVars(currentTheme.vars || DEFAULT_THEME.vars));

  const activePreset = CANVAS_THEMES.find(t => t.id === selectedThemeId);
  const effectiveVars = ensureThemeVars(themeTab === 'custom' ? customVars : (activePreset?.vars || DEFAULT_THEME.vars));

  function handleSave() {
    const theme = themeTab === 'custom'
      ? { id: 'custom', name: 'Custom', vars: ensureThemeVars(customVars) }
      : activePreset || DEFAULT_THEME;
    onSave({
      name,
      canvas_config: {
        ...cc,
        width: Number(width),
        height: Number(height),
        background: bg,
        theme: { id: theme.id, name: theme.name, vars: ensureThemeVars(themeTab === 'custom' ? customVars : theme.vars) },
      },
    });
    onClose();
  }

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm transition-all shadow-sm";
  const inputStyle = { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };
  const labelCls = "block text-[10px] font-semibold uppercase text-gray-500 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ pointerEvents: 'auto' }} onClick={onClose} />
      <div
        className="relative border rounded-xl w-full max-w-xl max-h-[85vh] overflow-y-auto"
        style={{ pointerEvents: 'auto', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div className="sticky top-0 px-5 py-4 z-10 flex items-center justify-between"
          style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Settings size={16} style={{ color: 'var(--color-accent)' }} />
            <h3 style={{ color: 'var(--color-text-primary)' }} className="text-sm font-semibold">Canvas Settings</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Name */}
          <div>
            <label className={labelCls} style={{ color: 'var(--color-text-secondary)' }}>Canvas Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} style={inputStyle} />
          </div>

          {/* Dimensions */}
          <div>
            <label className={labelCls} style={{ color: 'var(--color-text-secondary)' }}>Dimensions</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {DIMENSION_PRESETS.map(p => (
                <button key={p.label} onClick={() => { setWidth(p.w); setHeight(p.h); }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors"
                  style={{
                    borderColor: (width === p.w && height === p.h) ? 'var(--color-accent)' : 'var(--color-border)',
                    backgroundColor: (width === p.w && height === p.h) ? 'var(--color-accent-bg)' : 'transparent',
                    color: (width === p.w && height === p.h) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  }}>
                  {p.w}×{p.h}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text-secondary)' }}>Width</label>
                <input type="number" value={width} min={320} max={7680} onChange={e => setWidth(Number(e.target.value))} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text-secondary)' }}>Height</label>
                <input type="number" value={height} min={240} max={4320} onChange={e => setHeight(Number(e.target.value))} className={inputCls} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Background */}
          <div>
            <label className={labelCls} style={{ color: 'var(--color-text-secondary)' }}>Background Color</label>
            <div className="flex items-center gap-3">
              <CompactColorSwatch value={bg} onChange={setBg} varName="background" />
              <input type="text" value={bg} onChange={e => setBg(e.target.value)}
                className={inputCls + " flex-1 font-mono"} style={inputStyle} />
            </div>
          </div>

          {/* Theme Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Palette size={14} style={{ color: 'var(--color-accent)' }} />
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>Canvas Theme</label>
            </div>
            <p className="text-[11px] mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Theme colors are injected as CSS variables. Widgets use <code className="font-mono">var(--canvas-accent)</code> etc. to adapt.
            </p>

            {/* Preset / Custom tabs */}
            <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              {['presets', 'custom'].map(tab => (
                <button key={tab} onClick={() => setThemeTab(tab)}
                  className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize"
                  style={{
                    backgroundColor: themeTab === tab ? 'var(--color-surface)' : 'transparent',
                    color: themeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    boxShadow: themeTab === tab ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  }}>
                  {tab}
                </button>
              ))}
            </div>

            {themeTab === 'presets' ? (
              <div className="grid grid-cols-2 gap-2">
                {CANVAS_THEMES.map(theme => (
                  <button key={theme.id} onClick={() => { setSelectedThemeId(theme.id); setBg(theme.vars['--canvas-bg']); }}
                    className="relative p-3 rounded-xl border transition-all text-left group"
                    style={{
                      borderColor: selectedThemeId === theme.id ? 'var(--color-accent)' : 'var(--color-border)',
                      backgroundColor: theme.preview.bg,
                    }}>
                    {selectedThemeId === theme.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-accent)' }}>
                        <Check size={10} color="#fff" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: theme.preview.accent, borderColor: theme.preview.accent }} />
                      <span className="text-xs font-semibold" style={{ color: theme.vars['--canvas-text'] }}>{theme.name}</span>
                    </div>
                    <div className="flex gap-1">
                      {Object.values(theme.vars).slice(0, 5).map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Define custom CSS variables for your canvas theme:</p>
                {CANVAS_TOKEN_GROUPS.map(group => (
                  <div key={group.id} className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--color-text-secondary)' }}>
                      {group.label}
                    </div>
                    {group.tokens.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <CompactColorSwatch
                          value={customVars[key] || '#000000'}
                          onChange={c => setCustomVars(prev => ({ ...prev, [key]: c }))}
                          varName={key}
                        />
                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
                          <input type="text" value={customVars[key] || ''}
                            onChange={e => setCustomVars(prev => ({ ...prev, [key]: e.target.value }))}
                            className={inputCls + " font-mono text-xs"} style={inputStyle} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {/* Copy from preset */}
                <div className="flex flex-wrap gap-1.5 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <span className="text-[10px] w-full mb-1" style={{ color: 'var(--color-text-muted)' }}>Start from a preset:</span>
                  {CANVAS_THEMES.map(t => (
                    <button key={t.id} onClick={() => setCustomVars({ ...t.vars })}
                      className="px-2 py-1 rounded text-[10px] font-medium border transition-colors"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Theme preview strip */}
            <div className="mt-4 p-3 rounded-lg border" style={{ backgroundColor: effectiveVars['--canvas-bg'], borderColor: effectiveVars['--canvas-border'] }}>
              <p className="text-xs font-semibold mb-2" style={{ color: effectiveVars['--canvas-text'] }}>Theme Preview</p>
              <div className="flex gap-2">
                {THEME_VAR_KEYS.map((k) => (
                  <div key={k} className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 rounded-md border" style={{ backgroundColor: effectiveVars[k], borderColor: effectiveVars['--canvas-border'] }} />
                    <span className="text-[8px] font-mono" style={{ color: effectiveVars['--canvas-muted'] }}>{k.replace('--canvas-', '')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-5 py-3 flex justify-end gap-3"
          style={{ backgroundColor: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={handleSave}>
            <Check size={12} /> Apply Settings
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function AddWidgetModal({ registry, onAdd, onClose }) {
  const [selectedTier, setSelectedTier] = useState(() => loadSelectedRuntimeTier());
  const filteredRegistry = useMemo(
    () => registry.filter((w) => allowsTier(selectedTier, getWidgetRuntimeTier(w))),
    [registry, selectedTier]
  );

  useEffect(() => {
    saveSelectedRuntimeTier(selectedTier);
  }, [selectedTier]);

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
          <div className="mb-3 flex items-center gap-1 p-1 rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
            {["lite", "standard", "heavy"].map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(normalizeRuntimeTier(tier))}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize"
                style={{
                  backgroundColor: selectedTier === tier ? "var(--color-accent-bg)" : "transparent",
                  color: selectedTier === tier ? "var(--color-accent)" : "var(--color-text-secondary)",
                }}
              >
                {tier}
              </button>
            ))}
          </div>
          {filteredRegistry.length === 0 ? (
            <div className="px-3 py-6 text-xs" style={{ color: "var(--color-text-secondary)" }}>
              No widgets available in the selected runtime tier.
            </div>
          ) : filteredRegistry.map((w) => {
            const visuals = getWidgetVisuals(w);
            const runtimeTier = getWidgetRuntimeTier(w);
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
                    <Pill>{w.category || 'General'}</Pill>
                    <Pill>{w.daemon ? 'Daemon' : 'Native'}</Pill>
                    <Pill>{runtimeTier}</Pill>
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

function UnsavedChangesModal({ onStay, onLeave }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        style={{ pointerEvents: "auto" }}
        onClick={onStay}
      />
      <div
        className="relative w-full max-w-md rounded-2xl border shadow-2xl"
        style={{
          pointerEvents: "auto",
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Leave canvas?
          </h3>
          <p
            className="mt-2 text-sm leading-6"
            style={{ color: "var(--color-text-secondary)" }}
          >
            You have unsaved changes. Leaving now will discard them.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <GhostButton onClick={onStay}>Stay here</GhostButton>
          <PrimaryButton onClick={onLeave}>
            <ArrowLeft size={12} />
            Leave without saving
          </PrimaryButton>
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
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);
  const [editingInstanceId, setEditingInstanceId] = useState(null);

  useEffect(() => {
    window.__updateEditingId = setEditingInstanceId;
    return () => delete window.__updateEditingId;
  }, []);
  const [now, setNow] = useState(() => new Date());
  const [dirty, setDirty] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const dragState = useRef(null);
  const wasDragged = useRef(false);

  // Tick clock for live preview
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function handleMediaSelectorToggle(event) {
      setMediaSelectorOpen(Boolean(event?.detail?.open));
    }
    window.addEventListener("pi-media-selector-toggle", handleMediaSelectorToggle);
    return () => window.removeEventListener("pi-media-selector-toggle", handleMediaSelectorToggle);
  }, []);

  // Fetch this canvas
  const {
    data: canvasData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["canvas", canvasId],
    queryFn: async () => {
      const r = await fetch(`/api/canvases/${canvasId}`);
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
  // API returns { files: [...] }; derive mime_type from extension for FileInput filtering
  const rawMedia = Array.isArray(mediaData?.files) ? mediaData.files : (Array.isArray(mediaData) ? mediaData : []);
  const mediaFiles = rawMedia.map((f) => {
    const ext = (f.filename || "").split(".").pop()?.toLowerCase() || "";
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac", aac: "audio/aac", m4a: "audio/mp4", wma: "audio/x-ms-wma", opus: "audio/opus" };
    return { ...f, id: f.filename, mime_type: mimeMap[ext] || "application/octet-stream" };
  });

  // Canvas settings save handler
  const updateCanvasSettings = useCallback((changes) => {
    // Optimistically update the query cache
    queryClient.setQueryData(["canvas", canvasId], (old) => ({
      ...old,
      ...changes,
    }));
    setDirty(true);
  }, [queryClient, canvasId]);

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
  
  // Construct a live preview canvas object to send to the backend
  const previewCanvas = useMemo(() => {
    if (!canvasData) return null;
    return { ...canvasData, widgets: localWidgets };
  }, [canvasData, localWidgets]);
  
  const widgetData = useWidgetData(showPreview ? activeIds : [], showPreview ? previewCanvas : null);

  // Editing instance
  const editingInstance = useMemo(
    () => localWidgets.find((i) => i.id === editingInstanceId) || null,
    [localWidgets, editingInstanceId]
  );
  const previewThemeVars = ensureThemeVars(canvasData?.canvas_config?.theme?.vars || DEFAULT_THEME.vars);

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
      const nextZIndex = localWidgets.reduce(
        (max, widget) => Math.max(max, Number(widget?.layout?.zIndex || 0)),
        0
      ) + 1;
      const defaultConfig = Object.fromEntries(
        (manifest.configSchema || [])
          .filter((field) => field?.key)
          .map((field) => [field.key, field.default])
      );
      const defaultLayout = {
        x: 20,
        y: 20,
        width: manifest.defaults?.width || 200,
        height: manifest.defaults?.height || 200,
        zIndex: nextZIndex,
        opacity: 1,
        overflow: "hidden",
      };
      const newInst = {
        id: (window.crypto && crypto.randomUUID && crypto.randomUUID()) || ('w_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)),
        widget_id,
        label: manifest.name || "New Widget",
        enabled: true,
        layout: defaultLayout,
        config: defaultConfig,
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
      const r = await fetch(`/api/canvases/${canvasId}`, {
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

  const publishCanvas = useMutation({
    mutationFn: async () => {
      const cleanWidgets = localWidgets.map(({ manifest, ...rest }) => rest);
      const payload = {
        ...canvasData,
        widgets: cleanWidgets,
        widget_count: cleanWidgets.length,
      };
      delete payload.id;

      const saveResponse = await fetch(`/api/canvases/${canvasId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!saveResponse.ok) throw new Error("save");

      const publishResponse = await fetch(`/api/canvases/${canvasId}/publish`, {
        method: "POST",
      });
      if (!publishResponse.ok) throw new Error("publish");

      return publishResponse.json();
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["canvas", canvasId] });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
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

  function handleNavigateBack() {
    if (dirty) {
      setShowLeaveConfirm(true);
      return;
    }
    navigate("/");
  }

  return (
    <div
      className="h-screen overflow-hidden flex flex-col font-inter"
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
            onClick={handleNavigateBack}
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
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
            title="Canvas settings & themes"
          >
            <Settings size={12} />
            Settings
          </button>
          <button
            onClick={() => setShowLogs(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
            title="System logs"
          >
            <Terminal size={12} />
            Logs
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
            Save draft
          </PrimaryButton>
          <PrimaryButton
            onClick={() => publishCanvas.mutate()}
            disabled={publishCanvas.isPending}
          >
            {publishCanvas.isPending ? <Spinner size={12} /> : <Check size={12} />}
            Publish
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
          className="relative overflow-hidden select-none border shadow-2xl"
          style={{
            ...previewThemeVars,
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
                        themeVars={previewThemeVars}
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
          display: mediaSelectorOpen ? "none" : "flex",
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
              themeVars={previewThemeVars}
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

      {/* Canvas settings modal */}
      {showSettings && (
        <CanvasSettingsModal
          canvasData={canvasData}
          onSave={updateCanvasSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showLogs && (
        <LogsViewer onClose={() => setShowLogs(false)} />
      )}

      {showLeaveConfirm && (
        <UnsavedChangesModal
          onStay={() => setShowLeaveConfirm(false)}
          onLeave={() => navigate("/")}
        />
      )}
    </div>
  );
}

export default function CanvasEditorPage() {
  return <CanvasEditorShell />;
}
