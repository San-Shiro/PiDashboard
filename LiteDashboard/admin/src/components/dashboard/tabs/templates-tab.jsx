// Canvas management — every template IS a canvas with its own dimensions.
// Save, switch, apply, and configure display resolution per canvas.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Pill,
  StatusDot,
  SectionHeader,
  EmptyState,
  GhostButton,
  PrimaryButton,
  Spinner,
  FieldLabel,
} from "../ui-primitives";
import {
  LayoutTemplate,
  Save,
  Trash2,
  Check,
  Play,
  Monitor,
  Edit2,
  X,
} from "lucide-react";
import { CompactColorSwatch } from "../controls";

const PRESET_RESOLUTIONS = [
  { label: "1280 × 720  (HD)", width: 1280, height: 720 },
  { label: "1920 × 1080 (Full HD)", width: 1920, height: 1080 },
  { label: "2560 × 1440 (2K)", width: 2560, height: 1440 },
  { label: "3840 × 2160 (4K)", width: 3840, height: 2160 },
  { label: "Custom", width: null, height: null },
];

const DISPLAY_TARGETS = [
  { value: "primary", label: "Primary display" },
  { value: "secondary", label: "Secondary display" },
  { value: "all", label: "All displays" },
];

// Tiny SVG thumbnail of widget bounding boxes on the canvas
function CanvasThumbnail({ canvasConfig, widgetCount }) {
  const W = 200;
  const scaleX = canvasConfig?.width ? W / canvasConfig.width : W / 1280;
  const H = Math.round((canvasConfig?.height || 720) * scaleX);
  const bg = canvasConfig?.background || "#0a0a0a";

  // Fake representative widget boxes for visual hint
  const fakeBoxes = Array.from(
    { length: Math.min(widgetCount, 5) },
    (_, i) => ({
      x: 20 + (i % 3) * 55,
      y: 20 + Math.floor(i / 3) * 40,
      w: 45,
      h: 30,
    }),
  );

  return (
    <svg
      width={W}
      height={H}
      className="rounded-lg w-full"
      style={{ maxHeight: 100 }}
    >
      <rect width={W} height={H} fill={bg} rx="4" />
      {fakeBoxes.map((b, i) => (
        <rect
          key={i}
          x={b.x * scaleX}
          y={b.y * scaleX}
          width={b.w * scaleX}
          height={b.h * scaleX}
          fill="rgba(255,255,255,0.12)"
          rx="2"
        />
      ))}
      <text
        x={W / 2}
        y={H / 2 + 4}
        textAnchor="middle"
        fontSize="8"
        fill="rgba(255,255,255,0.3)"
        fontFamily="monospace"
      >
        {canvasConfig?.width || 1280} × {canvasConfig?.height || 720}
      </text>
    </svg>
  );
}

function CanvasSettingsPanel({ canvas, onClose, onSave }) {
  const cc = canvas.canvas_config || {};
  const [width, setWidth] = useState(cc.width || 1280);
  const [height, setHeight] = useState(cc.height || 720);
  const [bg, setBg] = useState(cc.background || "#0a0a0a");
  const [target, setTarget] = useState(cc.displayTarget || "primary");
  const [preset, setPreset] = useState("custom");

  const applyPreset = (p) => {
    setPreset(p.label);
    if (p.width) {
      setWidth(p.width);
      setHeight(p.height);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="absolute inset-0 bg-black/40"
        style={{ pointerEvents: "auto" }}
        onClick={onClose}
      />
      <div
        className="relative rounded-2xl w-full max-w-md border"
        style={{
          pointerEvents: "auto",
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Canvas settings — {canvas.name}
          </h3>
          <button
            onClick={onClose}
            style={{ color: "var(--color-text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <FieldLabel>Resolution preset</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_RESOLUTIONS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="px-3 py-1.5 rounded-lg text-xs border transition-colors"
                  style={{
                    backgroundColor:
                      preset === p.label
                        ? "var(--color-accent-bg)"
                        : "transparent",
                    borderColor:
                      preset === p.label
                        ? "var(--color-accent)"
                        : "var(--color-border)",
                    color:
                      preset === p.label
                        ? "var(--color-accent)"
                        : "var(--color-text-secondary)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Width (px)</FieldLabel>
              <input
                type="number"
                value={width}
                min={320}
                max={7680}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-surface)",
                }}
              />
            </div>
            <div>
              <FieldLabel>Height (px)</FieldLabel>
              <input
                type="number"
                value={height}
                min={240}
                max={4320}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-surface)",
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Background colour</FieldLabel>
              <div className="flex items-center gap-2">
                <CompactColorSwatch value={bg} onChange={setBg} varName="background" />
                <input
                  type="text"
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  className="flex-1 border rounded-lg px-2 py-2 text-sm font-mono"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--color-surface)",
                  }}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Display target</FieldLabel>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-surface)",
                }}
              >
                {DISPLAY_TARGETS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div
          className="flex justify-end gap-2 px-5 py-4 border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton
            onClick={() => {
              onSave({
                width,
                height,
                background: bg,
                displayTarget: target,
                pixelRatio: 1,
              });
              onClose();
            }}
          >
            <Save size={12} />
            Save canvas settings
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesTab({ onAfterApply }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingCanvas, setEditingCanvas] = useState(null);
  const navigate = useNavigate();

  // Canvas config for the "new canvas" form
  const [newWidth, setNewWidth] = useState(1280);
  const [newHeight, setNewHeight] = useState(720);
  const [newBg, setNewBg] = useState("#0a0a0a");
  const [newTarget, setNewTarget] = useState("primary");

  const { data, isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const r = await fetch("/api/templates");
      if (!r.ok) throw new Error("templates");
      return r.json();
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async ({ name, description, canvas_config }) => {
      const r = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, canvas_config }),
      });
      if (!r.ok) throw new Error("save");
      return r.json();
    },
    onSuccess: () => {
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });

  const updateCanvasConfig = useMutation({
    mutationFn: async ({ id, name, canvas_config }) => {
      // Re-save with updated canvas_config — snapshot stays current layout
      const r = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, canvas_config }),
      });
      if (!r.ok) throw new Error("update");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const applyTemplate = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/templates/${id}/apply`, { method: "POST" });
      if (!r.ok) throw new Error("apply");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["widget-instances"] });
      onAfterApply?.();
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const templates = data?.templates || [];

  return (
    <div className="space-y-8">
      {/* Save new canvas */}
      <div>
        <SectionHeader
          title="Create new canvas"
          subtitle="Define a canvas with dimensions and background. Edit it to add widgets and arrange the layout."
        />
        <Card className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <FieldLabel>Canvas name</FieldLabel>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Evening Lounge, Work Display..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-surface)",
                }}
              />
            </div>
            <div>
              <FieldLabel>Description (optional)</FieldLabel>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this layout for?"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-surface)",
                }}
              />
            </div>
          </div>

          {/* Canvas dimensions row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <FieldLabel>Width (px)</FieldLabel>
              <input
                type="number"
                value={newWidth}
                onChange={(e) => setNewWidth(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-surface)",
                }}
              />
            </div>
            <div>
              <FieldLabel>Height (px)</FieldLabel>
              <input
                type="number"
                value={newHeight}
                onChange={(e) => setNewHeight(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-surface)",
                }}
              />
            </div>
            <div>
              <FieldLabel>Background</FieldLabel>
              <div className="flex items-center gap-2">
                <CompactColorSwatch value={newBg} onChange={setNewBg} varName="background" />
                <input
                  type="text"
                  value={newBg}
                  onChange={(e) => setNewBg(e.target.value)}
                  className="flex-1 border rounded-lg px-2 py-2 text-sm font-mono"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--color-surface)",
                  }}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Display target</FieldLabel>
              <select
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-surface)",
                }}
              >
                {DISPLAY_TARGETS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {PRESET_RESOLUTIONS.filter((p) => p.width).map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setNewWidth(p.width);
                  setNewHeight(p.height);
                }}
                className="text-xs px-2 py-1 rounded border transition-colors"
                style={{
                  borderColor:
                    newWidth === p.width && newHeight === p.height
                      ? "var(--color-accent)"
                      : "var(--color-border)",
                  color:
                    newWidth === p.width && newHeight === p.height
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)",
                  backgroundColor:
                    newWidth === p.width && newHeight === p.height
                      ? "var(--color-accent-bg)"
                      : "transparent",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <PrimaryButton
            onClick={() =>
              saveTemplate.mutate({
                name,
                description,
                canvas_config: {
                  width: newWidth,
                  height: newHeight,
                  background: newBg,
                  displayTarget: newTarget,
                  pixelRatio: 1,
                },
              })
            }
            disabled={!name.trim() || saveTemplate.isLoading}
          >
            {saveTemplate.isLoading ? (
              <Spinner size={12} />
            ) : (
              <Save size={12} />
            )}
            Save canvas
          </PrimaryButton>
        </Card>
      </div>

      {/* Canvas list */}
      <div>
        <SectionHeader
          title="Saved canvases"
          subtitle="Each canvas has its own dimensions, background, and display target"
        />
        {isLoading ? (
          <Card className="py-12 flex justify-center">
            <Spinner size={20} />
          </Card>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<Monitor size={28} />}
            title="No canvases saved yet"
            description="Save the current layout above to create your first canvas."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((t) => {
              const cc = t.canvas_config || {};
              return (
                <Card key={t.id} className="p-5">
                  <CanvasThumbnail
                    canvasConfig={cc}
                    widgetCount={t.widget_count}
                  />

                  <div className="mt-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className="text-sm font-semibold truncate"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {t.name}
                        </h3>
                        {t.is_active && (
                          <Pill tone="blue">
                            <Check size={10} />
                            Active
                          </Pill>
                        )}
                      </div>
                      {t.description && (
                        <p
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {t.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/canvas/${t.id}/edit`)}
                      className="p-1.5 rounded-lg transition-colors shrink-0 ml-2"
                      style={{ color: "var(--color-text-muted)" }}
                      title="Edit canvas layout"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Pill>
                      <Monitor size={10} />
                      {cc.width || 1280} × {cc.height || 720}
                    </Pill>
                    <Pill>{t.widget_count} widgets</Pill>
                    <Pill>{cc.displayTarget || "primary"}</Pill>
                    <Pill>{new Date(t.updated_at).toLocaleDateString()}</Pill>
                  </div>

                  <div
                    className="flex items-center justify-between gap-2 mt-4 pt-3 border-t"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <GhostButton onClick={() => applyTemplate.mutate(t.id)}>
                      <Play size={11} />
                      Apply canvas
                    </GhostButton>
                    <button
                      onClick={() =>
                        window.confirm(`Delete canvas "${t.name}"?`) &&
                        deleteTemplate.mutate(t.id)
                      }
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--color-text-muted)" }}
                      title="Delete canvas"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {editingCanvas && (
        <CanvasSettingsPanel
          canvas={editingCanvas}
          onClose={() => setEditingCanvas(null)}
          onSave={(newCc) =>
            updateCanvasConfig.mutate({
              id: editingCanvas.id,
              name: editingCanvas.name,
              canvas_config: newCc,
            })
          }
        />
      )}
    </div>
  );
}
