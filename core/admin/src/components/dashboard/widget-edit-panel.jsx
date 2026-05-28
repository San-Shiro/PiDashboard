// Auto-generated config panel for a widget instance.
// Base fields (position, size, opacity, zIndex, schedule) are always present.
// Widget-specific fields are rendered from the manifest's configSchema.
import { useState } from "react";
import Icon from "./icon";
import ManifestField from "./manifest-field";
import { getWidgetVisuals, CANVAS_W, CANVAS_H } from "./widget-meta";
import { FieldLabel, GhostButton, PrimaryButton } from "./ui-primitives";
import { X, Trash2 } from "lucide-react";

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
}) {
  const [section, setSection] = useState("config");
  const manifest = instance.manifest || {};
  const visuals = getWidgetVisuals(manifest);
  const base = instance.base_config || {};
  const cfg = instance.widget_config || {};

  function updateBase(changes) {
    onUpdateInstance({ base_config: { ...base, ...changes } });
  }
  function updateCfg(key, value) {
    onUpdateInstance({ widget_config: { ...cfg, [key]: value } });
  }

  const sched =
    base.activeFrom === "00:00" && base.activeTo === "23:59"
      ? "Always on"
      : `${base.activeFrom} – ${base.activeTo}`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="absolute inset-0 bg-black/30"
        style={{ pointerEvents: "auto" }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md h-full overflow-y-auto"
        style={{
          pointerEvents: "auto",
          backgroundColor: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)"
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
          <button
            onClick={onClose}
            style={{ color: "var(--color-text-muted)" }}
            className="hover-surface-2 transition-colors p-1.5 rounded-lg shrink-0 ml-2"
          >
            <X size={16} />
          </button>
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
              <div>
                <FieldLabel>Instance label</FieldLabel>
                <input
                  type="text"
                  value={instance.label}
                  onChange={(e) => onUpdateInstance({ label: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                />
                <p className="text-xs text-gray-400 mt-1.5">
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
                    {manifest.tier === 2
                      ? "Dedicated daemon"
                      : "Bun-native fetch"}
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
                <h4 style={{ color: "var(--color-text-primary)" }} className="text-xs font-semibold uppercase tracking-wide mb-3">
                  Position
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>X (px)</FieldLabel>
                    <input
                      type="number"
                      value={base.x}
                      min={0}
                      max={CANVAS_W}
                      onChange={(e) =>
                        updateBase({ x: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <FieldLabel>Y (px)</FieldLabel>
                    <input
                      type="number"
                      value={base.y}
                      min={0}
                      max={CANVAS_H}
                      onChange={(e) =>
                        updateBase({ y: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ color: "var(--color-text-primary)" }} className="text-xs font-semibold uppercase tracking-wide mb-3">
                  Size
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Width</FieldLabel>
                    <input
                      type="number"
                      value={base.width}
                      min={20}
                      max={CANVAS_W}
                      onChange={(e) =>
                        updateBase({ width: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <FieldLabel>Height</FieldLabel>
                    <input
                      type="number"
                      value={base.height}
                      min={20}
                      max={CANVAS_H}
                      onChange={(e) =>
                        updateBase({ height: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ color: "var(--color-text-primary)" }} className="text-xs font-semibold uppercase tracking-wide mb-3">
                  Display
                </h4>
                <div className="space-y-3">
                  <div>
                    <FieldLabel>
                      Opacity — {Math.round((base.opacity ?? 1) * 100)}%
                    </FieldLabel>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={base.opacity ?? 1}
                      onChange={(e) =>
                        updateBase({ opacity: parseFloat(e.target.value) })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                  <div>
                    <FieldLabel>Z-index (layer order)</FieldLabel>
                    <input
                      type="number"
                      value={base.zIndex}
                      min={0}
                      max={100}
                      onChange={(e) =>
                        updateBase({ zIndex: Number(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
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
                manifest.configSchema.map((field) => (
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
                <h4 style={{ color: "var(--color-text-primary)" }} className="text-xs font-semibold uppercase tracking-wide mb-3">
                  Visibility window
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Active from</FieldLabel>
                    <input
                      type="time"
                      value={base.activeFrom || "00:00"}
                      onChange={(e) =>
                        updateBase({ activeFrom: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <FieldLabel>Active until</FieldLabel>
                    <input
                      type="time"
                      value={base.activeTo || "23:59"}
                      onChange={(e) => updateBase({ activeTo: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
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
    </div>
  );
}
