// Auto-generated config panel for a widget instance.
// Base fields (position, size, opacity, zIndex, schedule) are always present.
// Widget-specific fields are rendered from the manifest's configSchema.
import { useState } from "react";
import Icon from "./icon";
import ManifestField from "./manifest-field";
import { getWidgetVisuals } from "./widget-meta";
import { GhostButton, InspectorSection } from "./ui-primitives";
import { Trash2 } from "lucide-react";

import { SliderControl, RadioCards, ToggleSwitch } from "./controls";
import { CANVAS_TOKEN_GROUPS } from "@/data/canvas-themes";

const BASE_SECTIONS = [
  { id: "general", label: "General" },
  { id: "layout", label: "Layout" },
  { id: "config", label: "Content" },
];
const THEME_SECTION = { id: "theme", label: "Theme" };
const THEME_CAPABLE_WIDGETS = new Set([
  "image-slideshow",
  "text-title",
  "text-paragraph",
  "badge-label",
  "clock",
  "weather",
  "icon-text-info",
  "stat-kpi-card",
  "quote-callout",
  "ticker-marquee-text",
]);

function prettifyPanelLabel(id) {
  return String(id || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isThemeField(field) {
  if (!field) return false;
  if (field.panel === "theme") return true;
  if (["color", "background", "border", "radius", "box", "margin"].includes(field.type)) return true;
  return /color|background|border|radius|padding/i.test(String(field.key || ""));
}

function themeFieldGroup(field) {
  const key = String(field?.key || "");
  if (field?.type === "background") return "appearance";
  if (["border", "radius", "box", "margin"].includes(field?.type)) return "appearance";
  if (/padding|radius|border|background/i.test(key)) return "appearance";
  if (field?.type === "color" || /color/i.test(key)) return "colors";
  return "effects";
}

function MiniSliderRow({ label, value, onChange, min, max, step = 1, unit = "" }) {
  const safeValue = value ?? min;
  const percentage = ((safeValue - min) / (max - min)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-medium uppercase tracking-[0.06em]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {label}
        </span>
        <div
          className="flex h-6 items-center rounded-md border px-1.5 text-[11px] font-mono"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text-primary)",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={safeValue}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-8 bg-transparent text-right outline-none"
            style={{ color: "inherit" }}
          />
          {unit ? <span className="ml-1 text-[10px] opacity-70">{unit}</span> : null}
        </div>
      </div>
      <div className="relative flex h-4 items-center">
        <div
          className="absolute h-1.5 w-full rounded-full"
          style={{ backgroundColor: "var(--color-surface)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${percentage}%`,
              backgroundColor: "var(--color-accent)",
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute h-full w-full cursor-pointer opacity-0"
        />
        <div
          className="absolute h-4 w-4 rounded-full border bg-white shadow"
          style={{
            left: `calc(${percentage}% - 8px)`,
            borderColor: "var(--color-border)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

function findField(schema, key) {
  return (schema || []).find((field) => field.key === key);
}

export default function WidgetEditPanel({
  instance,
  onUpdateInstance,
  onDeleteInstance,
  mediaFiles,
  canvasW = 7680,
  canvasH = 4320,
}) {
  const manifest = instance.manifest || {};
  const schema = manifest.configSchema || [];
  const customPanelIds = Array.from(
    new Set(
      schema
        .map((field) => field?.panel)
        .filter((panel) => panel && !["general", "layout", "config", "content", "theme"].includes(panel))
    )
  );
  const hasThemePanel = THEME_CAPABLE_WIDGETS.has(manifest.id) || schema.some(isThemeField);
  const sections = [
    ...BASE_SECTIONS,
    ...(hasThemePanel ? [THEME_SECTION] : []),
    ...customPanelIds.map((id) => ({ id, label: prettifyPanelLabel(id) })),
  ];
  const initialSection = sections.some((item) => item.id === "config") ? "config" : sections[0]?.id || "general";
  const [section, setSection] = useState(initialSection);
  const visuals = getWidgetVisuals(manifest);
  
  // Notice: The canvas editor passes layout updates inside `layout` property now, 
  // not `base_config`, because we refactored it. 
  // Let's ensure this edit panel uses `layout` appropriately.
  const base = instance.layout || {};
  const cfg = instance.config || {};
  const compactConfigMode = manifest.id === "image-slideshow";

  function updateBase(changes) {
    onUpdateInstance({ layout: { ...base, ...changes } });
  }
  function updateCfg(key, value) {
    onUpdateInstance({ config: { ...cfg, [key]: value } });
  }

  function renderThemeSourcePicker() {
    if (!hasThemePanel) return null;
    return (
      <InspectorSection
        title="Engine Theme"
        description="Canvas Theme links this widget to the shared canvas tokens. Custom lets this widget override its own colors."
      >
        <RadioCards
          compact
          label=""
          value={cfg.__themeMode || "canvas"}
          onChange={(v) => updateCfg("__themeMode", v)}
          options={[
            { value: "canvas", label: "Canvas Theme" },
            { value: "custom", label: "Custom" },
          ]}
          columns={2}
        />
      </InspectorSection>
    );
  }

  function renderCanvasTokenPreview() {
    const tokenRows = CANVAS_TOKEN_GROUPS.flatMap(g => g.tokens.map(t => [t.label, t.key]));
    
    return (
      <InspectorSection title="Canvas Tokens">
        <div className="grid grid-cols-2 gap-2">
          {tokenRows.map(([label, cssVar]) => (
            <div
              key={cssVar}
              className="flex items-center gap-2 rounded-md border px-2 py-2"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
            >
              <span
                className="h-5 w-5 shrink-0 rounded-md border"
                style={{ backgroundColor: `var(${cssVar})`, borderColor: "var(--color-border)" }}
              />
              <span className="min-w-0 truncate text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </InspectorSection>
    );
  }

  function visibleSchemaFields(fields) {
    return fields.filter((field) => {
      if (!field) return false;
      if (field.showIf) {
        const depVal = cfg[field.showIf.key] ?? fields.find((f) => f.key === field.showIf.key)?.default;
        if (depVal !== field.showIf.value) return false;
      }
      return true;
    });
  }

  function renderFields(fields) {
    return fields.map((field) => (
      <ManifestField
        key={field.key}
        field={field}
        value={cfg[field.key] ?? field.default}
        onChange={(v) => updateCfg(field.key, v)}
        mediaFiles={mediaFiles}
        compact={compactConfigMode}
      />
    ));
  }

  function renderThemePanel(extraKeys = []) {
    const themeFields = visibleSchemaFields(schema).filter((field) => {
      if (extraKeys.includes(field.key)) return true;
      return isThemeField(field);
    });
    const appearanceFields = themeFields.filter((field) => themeFieldGroup(field) === "appearance");
    const colorFields = themeFields.filter((field) => themeFieldGroup(field) === "colors");
    const effectFields = themeFields.filter((field) => themeFieldGroup(field) === "effects");
    const customMode = (cfg.__themeMode || "canvas") === "custom";

    return (
      <div className="space-y-3">
        {renderThemeSourcePicker()}
        {!customMode ? renderCanvasTokenPreview() : null}
        {customMode && colorFields.length ? (
          <InspectorSection
            title="Custom Colors"
            description="These values override canvas tokens only for this widget."
          >
            <div className="space-y-2.5">{renderFields(colorFields)}</div>
          </InspectorSection>
        ) : null}
        {appearanceFields.length ? (
          <InspectorSection
            title="Appearance"
            description="Shape, background, border, and spacing stay configurable in both theme modes."
          >
            <div className="space-y-2.5">{renderFields(appearanceFields)}</div>
          </InspectorSection>
        ) : null}
        {effectFields.length ? (
          <InspectorSection title="Effects">
            <div className="space-y-2.5">{renderFields(effectFields)}</div>
          </InspectorSection>
        ) : null}
      </div>
    );
  }

  function renderFieldList(fields, currentPanel = "config") {
    const list = fields.filter((field) => {
      if (field.showIf) {
        const depVal = cfg[field.showIf.key] ?? fields.find((f) => f.key === field.showIf.key)?.default;
        if (depVal !== field.showIf.value) return false;
      }
      const panel = field.panel || (isThemeField(field) ? "theme" : "config");
      if (currentPanel === "config") return panel === "config" || panel === "content";
      return panel === currentPanel;
    });
    if (!list.length) {
      return (
        <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
          This widget has no configurable options in this panel.
        </p>
      );
    }
    return list.map((field) => (
      <div key={field.key}>
        <ManifestField
          field={field}
          value={cfg[field.key] ?? field.default}
          onChange={(v) => updateCfg(field.key, v)}
          mediaFiles={mediaFiles}
          compact={compactConfigMode}
        />
      </div>
    ));
  }

  function renderCompactSlideshowConfig(currentSection) {
    if (currentSection === "theme") {
      return (
        <div className="space-y-2.5">
          {renderThemePanel()}
          <InspectorSection title="Framing">
            <MiniSliderRow
              label="Corners"
              value={cfg.borderRadius ?? 0}
              onChange={(v) => updateCfg("borderRadius", v)}
              min={0}
              max={40}
              step={2}
              unit="px"
            />
          </InspectorSection>
        </div>
      );
    }
    if (currentSection === "performance") {
      return (
        <div className="space-y-2.5">
          <InspectorSection title="Playback">
            <div className="grid grid-cols-2 gap-2.5">
              <MiniSliderRow
                label="Duration"
                value={cfg.interval ?? 6}
                onChange={(v) => updateCfg("interval", v)}
                min={2}
                max={30}
                step={1}
                unit="s"
              />
              <MiniSliderRow
                label="Speed"
                value={cfg.transitionSpeed ?? 800}
                onChange={(v) => updateCfg("transitionSpeed", v)}
                min={300}
                max={2000}
                step={100}
                unit="ms"
              />
            </div>
            <ToggleSwitch
              compact
              label="Pause on hover"
              value={cfg.pauseOnHover ?? false}
              onChange={(v) => updateCfg("pauseOnHover", v)}
            />
            <ToggleSwitch
              compact
              label="Shuffle order"
              value={cfg.shuffle ?? false}
              onChange={(v) => updateCfg("shuffle", v)}
            />
          </InspectorSection>
        </div>
      );
    }
    const transition = cfg.transition ?? "crossfade";
    const fit = cfg.fit ?? "cover";
    const showIndicators = cfg.showIndicators ?? true;

    return (
      <div className="space-y-2.5">
        <InspectorSection title="Images">
          <ManifestField
            compact
            field={{
              key: "images",
              type: "media-list",
              label: "Selected media",
              hint: "",
              accepts: "image/*",
            }}
            value={cfg.images ?? ""}
            onChange={(v) => updateCfg("images", v)}
            mediaFiles={mediaFiles}
          />
        </InspectorSection>

        <InspectorSection title="Transitions">
          <RadioCards
            compact
            label="Effect"
            value={transition}
            onChange={(v) => updateCfg("transition", v)}
            options={[
              { value: "crossfade", label: "Crossfade" },
              { value: "slide", label: "Slide" },
              { value: "zoom", label: "Zoom" },
            ]}
            columns={3}
          />
          <RadioCards
            compact
            label="Image fit"
            value={fit}
            onChange={(v) => updateCfg("fit", v)}
            options={[
              { value: "cover", label: "Cover" },
              { value: "contain", label: "Contain" },
              { value: "fill", label: "Fill" },
            ]}
            columns={3}
          />
        </InspectorSection>

        <InspectorSection title="Options">
          <ToggleSwitch
            compact
            label="Show indicators"
            value={showIndicators}
            onChange={(v) => updateCfg("showIndicators", v)}
          />
        </InspectorSection>
      </div>
    );
  }

  function renderTextWidgetConfig(currentSection) {
    const titleWidget = manifest.id === "text-title";
    if (currentSection === "theme") {
      return renderThemePanel(titleWidget ? ["opacity"] : ["opacity"]);
    }
    if (currentSection !== "config") return null;
    const flowFields = titleWidget
      ? ["alignment", "verticalAlign", "transform", "wrap", "italic", "textWidth"]
      : ["alignment", "verticalAlign", "transform", "italic", "textWidth", "maxLines"];
    const typographyFields = ["textContent", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"];
    const effectsFields = titleWidget
      ? ["strokeWidth", "shadowBlur"]
      : ["shadowBlur"];

    return (
      <div className="space-y-3">
        <InspectorSection title="Typography">
          <div className="space-y-2.5">
            {typographyFields.map((key) => {
              const field = findField(schema, key);
              if (!field) return null;
              return (
                <ManifestField
                  key={field.key}
                  field={field}
                  value={cfg[field.key] ?? field.default}
                  onChange={(v) => updateCfg(field.key, v)}
                  mediaFiles={mediaFiles}
                />
              );
            })}
          </div>
        </InspectorSection>

        <InspectorSection title="Flow">
          <div className="space-y-2.5">
            {flowFields.map((key) => {
              const field = findField(schema, key);
              if (!field) return null;
              return (
                <ManifestField
                  key={field.key}
                  field={field}
                  value={cfg[field.key] ?? field.default}
                  onChange={(v) => updateCfg(field.key, v)}
                  mediaFiles={mediaFiles}
                />
              );
            })}
          </div>
        </InspectorSection>

        <InspectorSection title="Effects">
          <div className="space-y-2.5">
            {effectsFields.map((key) => {
              const field = findField(schema, key);
              if (!field) return null;
              return (
                <ManifestField
                  key={field.key}
                  field={field}
                  value={cfg[field.key] ?? field.default}
                  onChange={(v) => updateCfg(field.key, v)}
                  mediaFiles={mediaFiles}
                />
              );
            })}
          </div>
        </InspectorSection>
      </div>
    );
  }

  const sched =
    base.activeFrom === "00:00" && base.activeTo === "23:59"
      ? "Always on"
      : `${base.activeFrom} – ${base.activeTo}`;

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface)",
      }}
    >
        {/* Header */}
        <div
          className="shrink-0 px-5 py-4 flex items-center justify-between z-20"
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
          className="shrink-0 px-4 z-20"
          style={{
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)"
          }}
        >
          <div
            className="widget-panel-tabs flex gap-1.5 overflow-x-auto whitespace-nowrap py-2"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            <style>{`
              .widget-panel-tabs::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className="shrink-0 rounded-md px-2.5 py-1.5 text-[11px] leading-none transition-colors focus-visible:outline-none"
                style={{
                  color:
                    section === s.id
                      ? "var(--color-accent)"
                      : "var(--color-text-secondary)",
                  fontWeight: section === s.id ? 600 : 500,
                  backgroundColor:
                    section === s.id
                      ? "var(--color-accent-bg)"
                      : "transparent",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={compactConfigMode && section === "config" ? "p-4 space-y-4" : "p-4 space-y-4"}>
          {section === "general" && (
            <>
              <InspectorSection title="Identity">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                      Instance label
                    </label>
                    <input
                      type="text"
                      value={instance.label}
                      onChange={(e) => onUpdateInstance({ label: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                    <div className="flex justify-between gap-3"><span>Widget</span><span style={{ color: "var(--color-text-primary)" }} className="font-medium">{manifest.name}</span></div>
                    <div className="flex justify-between gap-3"><span>Version</span><span style={{ color: "var(--color-text-primary)" }} className="font-mono">{manifest.version}</span></div>
                    <div className="flex justify-between gap-3"><span>Author</span><span style={{ color: "var(--color-text-primary)" }}>{manifest.author}</span></div>
                    <div className="flex justify-between gap-3"><span>RAM</span><span style={{ color: "var(--color-text-primary)" }} className="font-mono">{manifest.estimatedRamMb || 0} MB</span></div>
                  </div>
                </div>
              </InspectorSection>

              <InspectorSection title="Visibility">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Active from</label>
                    <input
                      type="time"
                      value={base.activeFrom || "00:00"}
                      onChange={(e) => updateBase({ activeFrom: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Active until</label>
                    <input
                      type="time"
                      value={base.activeTo || "23:59"}
                      onChange={(e) => updateBase({ activeTo: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm shadow-sm"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <GhostButton onClick={() => updateBase({ activeFrom: "00:00", activeTo: "23:59" })}>Always on</GhostButton>
                  <GhostButton onClick={() => updateBase({ activeFrom: "06:00", activeTo: "22:00" })}>Daytime</GhostButton>
                  <GhostButton onClick={() => updateBase({ activeFrom: "18:00", activeTo: "23:00" })}>Evening</GhostButton>
                </div>
              </InspectorSection>

              <div style={{ borderTop: "1px solid var(--color-border)" }} className="pt-2">
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
              <InspectorSection title="Position">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--color-text-secondary)" }}>X (px)</label>
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
              </InspectorSection>

              <InspectorSection title="Size">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Width (px)</label>
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
              </InspectorSection>

              <InspectorSection title="Display">
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
                    <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Z-index</label>
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
              </InspectorSection>
            </>
          )}

          {(section === "config" || section === "theme" || customPanelIds.includes(section)) && (
            <div className={compactConfigMode ? "space-y-3" : "space-y-4"}>
              {compactConfigMode ? renderCompactSlideshowConfig(section) : manifest.id === "text-title" || manifest.id === "text-paragraph" ? renderTextWidgetConfig(section) : section === "theme" ? (
              renderThemePanel()
              ) : customPanelIds.includes(section) ? (
              <>
              {renderFieldList(manifest.configSchema || [], section)}
              </>
              ) : (
              <>
              {renderFieldList(manifest.configSchema || [], "config")}
              </>
              )}
            </div>
          )}

        </div>
        </div>
    </div>
  );
}
