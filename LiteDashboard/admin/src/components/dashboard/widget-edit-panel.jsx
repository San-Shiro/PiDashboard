// Auto-generated config panel for a widget instance.
// Base fields (position, size, opacity, zIndex, schedule) are always present.
// Widget-specific fields are rendered from the manifest's configSchema.
import { useState } from "react";
import Icon from "./icon";
import ManifestField from "./manifest-field";
import { getWidgetVisuals } from "./widget-meta";
import { FieldLabel, GhostButton, PrimaryButton } from "./ui-primitives";
import { X, Trash2 } from "lucide-react";

import { SliderControl } from "./controls";

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "layout", label: "Layout" },
  { id: "config", label: "Widget config" },
  { id: "schedule", label: "Schedule" },
];

export default function WidgetEditPanel({
  instance,
  onUpdateInstance,
  onDeleteInstance,
  onClose,
  mediaFiles,
  canvasW = 7680,
  canvasH = 4320,
}) {
  const [section, setSection] = useState("config");
  const manifest = instance.manifest || {};
  const visuals = getWidgetVisuals(manifest);
  
  // Notice: The canvas editor passes layout updates inside `layout` property now, 
  // not `base_config`, because we refactored it. 
  // Let's ensure this edit panel uses `layout` appropriately.
  const base = instance.layout || {};
  const cfg = instance.config || {};

  function updateBase(changes) {
    onUpdateInstance({ layout: { ...base, ...changes } });
  }
  function updateCfg(key, value) {
    onUpdateInstance({ config: { ...cfg, [key]: value } });
  }

  const sched =
    base.activeFrom === "00:00" && base.activeTo === "23:59"
      ? "Always on"
      : `${base.activeFrom} – ${base.activeTo}`;

  return (
    <div
      className="flex flex-col h-full w-full overflow-y-auto"
      style={{
        backgroundColor: "var(--color-surface)",
      }}
    >
        {/* Header */}
        <div
          className="sticky top-0 px-5 py-4 flex items-center justify-between z-10"
          style={{
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)"
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: visuals.bg }}
            >
              <Icon
                name={manifest.icon}
                size={16}
                style={{ color: visuals.color }}
              />
            </div>
            <div className="min-w-0">
              <h3 style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold truncate">
                {instance.label}
              </h3>
              <p style={{ color: "var(--color-text-secondary)" }} className="text-xs capitalize">
                {manifest.name || instance.widget_id}{" "}
                <span style={{ color: "var(--color-border)" }}>·</span> {sched}
              </p>
            </div>
          </div>
        </div>

        {/* Section tabs */}
        <div
          className="px-5 sticky top-[57px] z-10"
          style={{
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)"
          }}
        >
          <div className="flex gap-5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className="pb-3 -mb-[1px] text-xs border-b-2 transition-colors focus-visible:outline-none"
                style={{
                  color:
                    section === s.id
                      ? "var(--color-text-primary)"
                      : "var(--color-text-secondary)",
                  fontWeight: section === s.id ? 500 : 400,
                  borderColor:
                    section === s.id ? "var(--color-accent)" : "transparent",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-6">
          {section === "general" && (
            <>
              <div className="mb-5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  Instance label
                </label>
                <input
                  type="text"
                  value={instance.label}
                  onChange={(e) => onUpdateInstance({ label: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all shadow-sm"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <p className="text-[10px] text-gray-400 mt-1.5" style={{ color: "var(--color-text-muted)" }}>
                  Internal name shown in the admin panel only
                </p>
              </div>
              <div
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  color: "var(--color-text-secondary)"
                }}
                className="rounded-lg p-3 text-xs space-y-1.5"
              >
                <div className="flex justify-between">
                  <span>Widget</span>
                  <span style={{ color: "var(--color-text-primary)" }} className="font-medium">
                    {manifest.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Version</span>
                  <span style={{ color: "var(--color-text-primary)" }} className="font-mono">
                    {manifest.version}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Author</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{manifest.author}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated RAM</span>
                  <span style={{ color: "var(--color-text-primary)" }} className="font-mono">
                    {manifest.estimatedRamMb || 0} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tier</span>
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {manifest.daemon
                      ? "Daemon-powered"
                      : "Standalone"}
                  </span>
                </div>
              </div>
              <div
                style={{ borderTop: "1px solid var(--color-border)" }}
                className="pt-2"
              >
                <GhostButton
                  danger
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete "${instance.label}"? This removes the widget from your layout.`,
                      )
                    ) {
                      onDeleteInstance();
                    }
                  }}
                >
                  <Trash2 size={11} />
                  Delete this widget instance
                </GhostButton>
              </div>
            </>
          )}

          {section === "layout" && (
            <>
              <div>
                <h4 style={{ color: "var(--color-text-primary)" }} className="text-[11px] font-semibold uppercase tracking-wide mb-3">
                  Position
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1.5" style={{ color: "var(--color-text-secondary)" }}>X (px)</label>
                    <input
                      type="number"
                      value={base.x}
                      min={0}
                      max={canvasW}
                      onChange={(e) =>
                        updateBase({ x: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm transition-all shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Y (px)</label>
                    <input
                      type="number"
                      value={base.y}
                      min={0}
                      max={canvasH}
                      onChange={(e) =>
                        updateBase({ y: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm transition-all shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ color: "var(--color-text-primary)" }} className="text-[11px] font-semibold uppercase tracking-wide mb-3 mt-6">
                  Size
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Width (px)</label>
                    <input
                      type="number"
                      value={base.width}
                      min={20}
                      max={canvasW}
                      onChange={(e) =>
                        updateBase({ width: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm transition-all shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Height (px)</label>
                    <input
                      type="number"
                      value={base.height}
                      min={20}
                      max={canvasH}
                      onChange={(e) =>
                        updateBase({ height: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm transition-all shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ color: "var(--color-text-primary)" }} className="text-[11px] font-semibold uppercase tracking-wide mb-3 mt-6">
                  Display
                </h4>
                <div className="space-y-4">
                  <SliderControl
                    label="Opacity"
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    value={Math.round((base.opacity ?? 1) * 100)}
                    onChange={(val) => updateBase({ opacity: val / 100 })}
                  />
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Z-index (layer order)</label>
                    <input
                      type="number"
                      value={base.zIndex}
                      min={0}
                      max={100}
                      onChange={(e) =>
                        updateBase({ zIndex: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm transition-all shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <SliderControl
                    label="Border Radius"
                    min={0}
                    max={100}
                    step={1}
                    unit="px"
                    value={base.borderRadius || 0}
                    onChange={(val) => updateBase({ borderRadius: val })}
                  />
                </div>
              </div>
            </>
          )}

          {section === "config" && (
            <div className="space-y-4">
              {(manifest.configSchema || []).length === 0 ? (
                <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
                  This widget has no configurable options.
                </p>
              ) : (
                manifest.configSchema.filter(field => {
                  if (field.showIf) {
                    const depVal = cfg[field.showIf.key] ?? manifest.configSchema.find(f => f.key === field.showIf.key)?.default;
                    return depVal === field.showIf.value;
                  }
                  return true;
                }).map((field) => (
                  <ManifestField
                    key={field.key}
                    field={field}
                    value={cfg[field.key] ?? field.default}
                    onChange={(v) => updateCfg(field.key, v)}
                    mediaFiles={mediaFiles}
                  />
                ))
              )}
            </div>
          )}

          {section === "schedule" && (
            <>
              <div>
                <h4 style={{ color: "var(--color-text-primary)" }} className="text-[11px] font-semibold uppercase tracking-wide mb-3">
                  Visibility window
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Active from</label>
                    <input
                      type="time"
                      value={base.activeFrom || "00:00"}
                      onChange={(e) =>
                        updateBase({ activeFrom: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Active until</label>
                    <input
                      type="time"
                      value={base.activeTo || "23:59"}
                      onChange={(e) => updateBase({ activeTo: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <GhostButton
                    onClick={() =>
                      updateBase({ activeFrom: "00:00", activeTo: "23:59" })
                    }
                  >
                    Always on
                  </GhostButton>
                  <GhostButton
                    onClick={() =>
                      updateBase({ activeFrom: "06:00", activeTo: "22:00" })
                    }
                  >
                    Daytime
                  </GhostButton>
                  <GhostButton
                    onClick={() =>
                      updateBase({ activeFrom: "18:00", activeTo: "23:00" })
                    }
                  >
                    Evening
                  </GhostButton>
                </div>
              </div>
            </>
          )}
        </div>
    </div>
  );
}
