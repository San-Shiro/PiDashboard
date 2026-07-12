import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Minus, Plus, Link2, Unlink, Check, Info } from "lucide-react";
import { CANVAS_TOKEN_GROUPS, CANVAS_TOKEN_OPTIONS } from "@/data/canvas-themes";

// Shared standard label
function ControlLabel({ label, description, compact = false, hintDisplay = "text" }) {
  return (
    <div className={compact ? "mb-1" : "mb-2"}>
      <div className="flex items-center gap-1.5">
        <label className={compact ? "block text-[10px] font-medium uppercase tracking-[0.06em] text-gray-500" : "block text-[11px] font-semibold uppercase tracking-wider text-gray-500"} style={{ color: "var(--color-text-secondary)" }}>
          {label}
        </label>
        {description ? (
          <span
            className="inline-flex items-center justify-center"
            title={description}
            style={{ color: "var(--color-text-muted)" }}
          >
            <Info size={compact ? 10 : 12} />
          </span>
        ) : null}
      </div>
      {description && hintDisplay !== "icon" ? <p className={compact ? "text-[9px] mt-0.5 text-gray-400 leading-4" : "text-[10px] mt-0.5 text-gray-400"} style={{ color: "var(--color-text-muted)" }}>{description}</p> : null}
    </div>
  );
}

import { HexAlphaColorPicker } from "react-colorful";

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#22c55e", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#f43f5e", "#ffffff",
  "#94a3b8", "#475569", "#1e293b", "#000000",
];

function isCanvasTokenValue(value) {
  return /^var\(--canvas-[^)]+\)$/.test(String(value || "").trim());
}

function extractCanvasToken(value) {
  const match = String(value || "").trim().match(/^var\((--canvas-[^)]+)\)$/);
  return match ? match[1] : "";
}

function asCanvasTokenValue(tokenKey) {
  return tokenKey ? `var(${tokenKey})` : "";
}

function resolveDisplayColor(value, themeVars, fallback = "#000000") {
  if (!value) return fallback;
  if (isCanvasTokenValue(value)) {
    const token = extractCanvasToken(value);
    return themeVars?.[token] || fallback;
  }
  return value;
}

function canUseDirectPickerValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (isCanvasTokenValue(raw)) return false;
  return /^#([0-9a-f]{3,8})$/i.test(raw) || /^rgba?\(/i.test(raw) || /^hsla?\(/i.test(raw);
}

// 1. Color Picker (Premium inline popover)
export function ColorPicker({ label, description, value, onChange, themeVars = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const popover = useRef();
  const tokenMode = isCanvasTokenValue(value);
  const selectedToken = extractCanvasToken(value) || CANVAS_TOKEN_OPTIONS[0]?.key || "--canvas-text";
  const displayColor = resolveDisplayColor(value, themeVars, "#000000");
  const pickerColor = canUseDirectPickerValue(value) ? (value || "#000000") : displayColor;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popover.current && !popover.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="mb-5 relative">
      <ControlLabel label={label} description={description} />
      <div
        className="flex items-center gap-2.5 mt-1.5 p-1.5 rounded-lg border transition-all cursor-pointer"
        style={{ backgroundColor: "var(--color-surface)", borderColor: isOpen ? "var(--color-accent)" : "var(--color-border)" }}
        onClick={() => setIsOpen(true)}
      >
        <div
          className="w-8 h-8 rounded-md shadow-inner shrink-0 border"
          style={{
            backgroundColor: displayColor,
            borderColor: "var(--color-border)",
            backgroundImage: !value ? "linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)" : "none",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
          }}
        />
        <span className="flex-1 text-xs font-mono uppercase tracking-wide" style={{ color: "var(--color-text-primary)" }}>
          {tokenMode ? (CANVAS_TOKEN_OPTIONS.find((opt) => opt.key === selectedToken)?.label || selectedToken) : (value || "None")}
        </span>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--color-text-muted)" }} />
      </div>

      {isOpen && (
        <div
          ref={popover}
          className="absolute top-full left-0 mt-2 z-50 rounded-xl shadow-2xl border overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            animation: "colorPickerIn 0.15s ease-out",
          }}
        >
          <style>{`
            @keyframes colorPickerIn {
              from { opacity: 0; transform: translateY(-4px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .color-picker-popover .react-colorful {
              width: 240px !important;
              height: auto !important;
            }
            .color-picker-popover .react-colorful__saturation {
              height: 160px !important;
              border-radius: 8px 8px 0 0 !important;
              border-bottom: none !important;
            }
            .color-picker-popover .react-colorful__hue {
              height: 12px !important;
              border-radius: 6px !important;
              margin: 0 !important;
            }
            .color-picker-popover .react-colorful__saturation-pointer,
            .color-picker-popover .react-colorful__hue-pointer {
              width: 16px !important;
              height: 16px !important;
              border: 2px solid #fff !important;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4) !important;
            }
          `}</style>
          <div className="color-picker-popover p-3">
            <div className="mb-3 inline-flex rounded-lg border p-1" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}>
              <button
                type="button"
                onClick={() => onChange(tokenMode ? "" : (value || ""))}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium"
                style={{
                  backgroundColor: !tokenMode ? "var(--color-surface)" : "transparent",
                  color: !tokenMode ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                }}
              >
                Custom
              </button>
              <button
                type="button"
                onClick={() => onChange(asCanvasTokenValue(selectedToken))}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium"
                style={{
                  backgroundColor: tokenMode ? "var(--color-surface)" : "transparent",
                  color: tokenMode ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                }}
              >
                Theme Token
              </button>
            </div>

            {tokenMode ? (
              <div className="space-y-3">
                {CANVAS_TOKEN_GROUPS.map((group) => (
                  <div key={group.id}>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--color-text-secondary)" }}>
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.tokens.map((token) => {
                        const active = token.key === selectedToken;
                        return (
                          <button
                            key={token.key}
                            type="button"
                            onClick={() => onChange(asCanvasTokenValue(token.key))}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
                            style={{
                              backgroundColor: active ? "var(--color-accent-bg)" : "transparent",
                              color: active ? "var(--color-accent)" : "var(--color-text-primary)",
                            }}
                          >
                            <span className="h-4 w-4 rounded border shrink-0" style={{ backgroundColor: themeVars?.[token.key] || "#000000", borderColor: "var(--color-border)" }} />
                            <span className="min-w-0 flex-1 truncate text-xs">{token.label}</span>
                            {active ? <Check size={12} /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <HexAlphaColorPicker color={pickerColor} onChange={onChange} />

                {/* Hex input */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-6 h-6 rounded-md shrink-0 border" style={{ backgroundColor: displayColor, borderColor: "var(--color-border)" }} />
                  <input
                    type="text"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#000000"
                    className="flex-1 border rounded-md px-2 py-1.5 text-xs font-mono uppercase tracking-wide outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      borderColor: "var(--color-border)",
                      color: "var(--color-text-primary)",
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                {/* Quick presets */}
                <div className="grid grid-cols-8 gap-1 mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChange(c)}
                      className="w-6 h-6 rounded-md border transition-transform hover:scale-110 active:scale-95"
                      style={{
                        backgroundColor: c,
                        borderColor: value === c ? "var(--color-accent)" : "var(--color-border)",
                        boxShadow: value === c ? "0 0 0 2px var(--color-accent)" : "none",
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact color swatch — used in grids (themes, canvas settings). No label. */
export function CompactColorSwatch({ value, onChange, varName }) {
  const [isOpen, setIsOpen] = useState(false);
  const popover = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popover.current && !popover.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-lg border cursor-pointer transition-transform hover:scale-110 active:scale-95 shrink-0"
        style={{ backgroundColor: value || "#000000", borderColor: "var(--color-border)" }}
        title={varName || value}
      />
      {isOpen && (
        <div
          ref={popover}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 rounded-xl shadow-2xl border overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            animation: "colorPickerIn 0.15s ease-out",
          }}
        >
          <style>{`
            @keyframes colorPickerIn {
              from { opacity: 0; transform: translateY(4px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .compact-picker .react-colorful {
              width: 200px !important;
              height: auto !important;
            }
            .compact-picker .react-colorful__saturation {
              height: 130px !important;
              border-radius: 8px 8px 0 0 !important;
              border-bottom: none !important;
            }
            .compact-picker .react-colorful__hue {
              height: 10px !important;
              border-radius: 5px !important;
            }
            .compact-picker .react-colorful__saturation-pointer,
            .compact-picker .react-colorful__hue-pointer {
              width: 14px !important;
              height: 14px !important;
              border: 2px solid #fff !important;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4) !important;
            }
          `}</style>
          <div className="compact-picker p-2.5">
            <HexAlphaColorPicker color={value || "#000000"} onChange={onChange} />
            <input
              type="text"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="w-full mt-2 border rounded-md px-2 py-1 text-[10px] font-mono uppercase outline-none"
              style={{
                backgroundColor: "var(--color-bg)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
              }}
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// 2. Slider Control (with inline number input)
export function SliderControl({ label, description, value, onChange, min = 0, max = 100, step = 1, unit = "", compact = false, hintDisplay = "text" }) {
  const val = value ?? min;
  const percentage = ((val - min) / (max - min)) * 100;
  
  return (
    <div className={compact ? "mb-3" : "mb-5"}>
      <style>{`
        .custom-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          background: transparent;
          outline: none;
        }
        .custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          border: 1px solid var(--color-border);
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          transition: transform 0.1s;
        }
        .custom-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>
      <div className={compact ? "flex justify-between items-center gap-2 mb-1" : "flex justify-between items-end mb-2"}>
        <ControlLabel label={label} description={description} compact={compact} hintDisplay={hintDisplay} />
        <div className={`flex items-center border rounded-md flex-shrink-0 bg-transparent overflow-hidden shadow-sm ${compact ? "h-6 px-1.5" : "h-6"}`} style={{ borderColor: "var(--color-border)" }}>
          <input
            type="number"
            value={val}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            className={compact ? "w-9 text-center text-[11px] font-mono outline-none border-0 m-0 p-0 bg-transparent" : "w-12 text-center text-xs font-mono outline-none border-0 m-0 p-0 bg-transparent"}
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>
      </div>
      <div className={compact ? "relative h-4.5 flex items-center group" : "relative h-6 flex items-center group"}>
        <div className={`absolute w-full ${compact ? "h-1.5" : "h-1.5"} bg-gray-200 rounded-full pointer-events-none`} style={{ backgroundColor: "var(--color-surface-2)" }}>
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percentage}%`, backgroundColor: "var(--color-accent)" }} />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={val}
          onChange={(e) => onChange(Number(e.target.value))}
          className="custom-slider absolute w-full h-full cursor-pointer z-10 m-0 p-0"
        />
      </div>
    </div>
  );
}

// 3. Toggle Switch (iOS style)
export function ToggleSwitch({ label, description, value, onChange, compact = false, hintDisplay = "text" }) {
  return (
    <div className={compact ? "mb-2.5 flex items-center justify-between gap-3" : "mb-5 flex items-center justify-between gap-4"}>
      <div className="min-w-0">
        <ControlLabel label={label} description={description} compact={compact} hintDisplay={hintDisplay} />
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex shrink-0 items-center rounded-full border transition-colors ${
          compact ? "h-5 w-9 p-[2px]" : "h-6 w-11 p-[2px]"
        } ${
          value ? "bg-blue-500" : "bg-gray-300"
        }`}
        style={{
          backgroundColor: value ? "var(--color-accent)" : "var(--color-surface-2)",
          borderColor: value ? "var(--color-accent)" : "var(--color-border)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <span
          className={`inline-block rounded-full border bg-white shadow-sm transition-transform ${
            compact ? "h-3.5 w-3.5" : "h-4.5 w-4.5"
          } ${value ? (compact ? "translate-x-[14px]" : "translate-x-[20px]") : "translate-x-0"}`}
          style={{
            borderColor: "rgba(15,23,42,0.08)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          }}
        />
      </button>
    </div>
  );
}

// 4. Select Dropdown (Premium minimal design)
export function SelectDropdown({ label, description, value, onChange, options = [], hintDisplay = "text" }) {
  return (
    <div className="mb-5">
      <ControlLabel label={label} description={description} hintDisplay={hintDisplay} />
      <div className="relative mt-1.5">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm pr-8"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
          <ChevronDown size={14} />
        </div>
      </div>
    </div>
  );
}

export function PreviewSelectDropdown({
  label,
  description,
  value,
  onChange,
  options = [],
  previewMode = "default",
  hintDisplay = "text",
}) {
  const [open, setOpen] = useState(false);
  const popover = useRef();
  const selected = options.find((opt) => String(opt.value) === String(value)) || options[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popover.current && !popover.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="mb-5 relative">
      <ControlLabel label={label} description={description} hintDisplay={hintDisplay} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full mt-1.5 border rounded-lg px-3 py-2 text-left transition-all shadow-sm flex items-center justify-between gap-3"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: open ? "var(--color-accent)" : "var(--color-border)",
          color: "var(--color-text-primary)",
        }}
      >
        <div className="min-w-0">
          <div
            className="truncate text-sm"
            style={previewMode === "font" ? { fontFamily: selected?.value || "inherit" } : undefined}
          >
            {selected?.label || "Select"}
          </div>
        </div>
        <ChevronDown size={14} style={{ color: "var(--color-text-muted)" }} />
      </button>

      {open && (
        <div
          ref={popover}
          className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border shadow-2xl overflow-hidden"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="max-h-72 overflow-y-auto p-2">
            {options.map((opt) => {
              const isActive = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left flex items-center justify-between gap-3 transition-colors"
                  style={{
                    backgroundColor: isActive ? "var(--color-accent-bg)" : "transparent",
                    color: isActive ? "var(--color-accent)" : "var(--color-text-primary)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-sm"
                      style={previewMode === "font" ? { fontFamily: opt.value } : undefined}
                    >
                      {opt.label}
                    </div>
                  </div>
                  {isActive ? <Check size={14} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// 5. Margin Box (Top, Right, Bottom, Left with optional linking)
export function MarginBox({ label, description, value = {}, onChange, min = Number.NEGATIVE_INFINITY }) {
  const [linked, setLinked] = useState(true);
  
  const v = { top: 0, right: 0, bottom: 0, left: 0, ...value };

  const clamp = (n) => Math.max(min, Number.isFinite(n) ? n : 0);
  const handleChange = (key, val) => {
    const safe = clamp(val);
    if (linked) {
      onChange({ top: safe, right: safe, bottom: safe, left: safe });
    } else {
      onChange({ ...v, [key]: safe });
    }
  };

  const inputs = [
    { key: "top", label: "T" },
    { key: "right", label: "R" },
    { key: "bottom", label: "B" },
    { key: "left", label: "L" },
  ];

  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <ControlLabel label={label} description={description} />
        </div>
        <button 
          type="button" 
          onClick={() => setLinked(!linked)}
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors"
          style={{
            borderColor: linked ? "var(--color-accent)" : "var(--color-border)",
            backgroundColor: linked ? "var(--color-accent-bg)" : "var(--color-surface)",
            color: linked ? "var(--color-accent)" : "var(--color-text-secondary)",
          }}
          title={linked ? "Unlink values" : "Link values together"}
        >
          {linked ? <Link2 size={12} /> : <Unlink size={12} />}
        </button>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {inputs.map(({ key, label }) => (
          <div key={key} className="overflow-hidden rounded-md border flex flex-col shadow-sm" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
            <input
              type="number"
              value={v[key]}
              onChange={(e) => handleChange(key, Number(e.target.value))}
              className="w-full appearance-none text-center text-xs p-2 outline-none border-b font-mono bg-transparent [moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              style={{ color: "var(--color-text-primary)", borderColor: "var(--color-surface-2)" }}
            />
            <span className="text-[9px] text-center py-1 font-medium uppercase" style={{ color: "var(--color-text-muted)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 6. Typography Panel (Combines Font, Weight, Size)
export function TypographyPanel({ label, description, value = {}, onChange }) {
  const v = { fontFamily: "Inter", fontWeight: 400, fontSize: 14, ...value };

  return (
    <div className="mb-5 border rounded-lg p-3 bg-gray-50/50 shadow-sm" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-2)" }}>
      <ControlLabel label={label || "Typography"} description={description} />
      
      <div className="space-y-3 mt-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <span className="text-[10px] text-gray-400 mb-1 block">Family</span>
            <select
              value={v.fontFamily}
              onChange={(e) => onChange({ ...v, fontFamily: e.target.value })}
              className="w-full bg-white border rounded-md px-2 py-1.5 text-xs outline-none focus:border-blue-500 shadow-sm"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
            >
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Outfit">Outfit</option>
              <option value="monospace">Monospace</option>
            </select>
          </div>
          <div className="w-24">
            <span className="text-[10px] text-gray-400 mb-1 block">Weight</span>
            <select
              value={v.fontWeight}
              onChange={(e) => onChange({ ...v, fontWeight: Number(e.target.value) })}
              className="w-full bg-white border rounded-md px-2 py-1.5 text-xs outline-none focus:border-blue-500 shadow-sm"
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
            >
              <option value={300}>Light</option>
              <option value={400}>Normal</option>
              <option value={500}>Medium</option>
              <option value={600}>Semibold</option>
              <option value={700}>Bold</option>
            </select>
          </div>
        </div>
        
        <div>
          <span className="text-[10px] text-gray-400 mb-1 block">Size ({v.fontSize}px)</span>
          <input
            type="range"
            min={8}
            max={72}
            value={v.fontSize}
            onChange={(e) => onChange({ ...v, fontSize: Number(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

// 7. Radio Cards (Segmented visual choice)
export function RadioCards({ label, description, value, onChange, options = [], compact = false, columns = 2, hintDisplay = "text" }) {
  return (
    <div className={compact ? "mb-2.5" : "mb-5"}>
      <ControlLabel label={label} description={description} compact={compact} hintDisplay={hintDisplay} />
      <div
        className={`grid ${compact ? "gap-1.5 mt-0.5" : "gap-2 mt-1.5"}`}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const isActive = String(opt.value) === String(value);
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex ${compact ? "min-h-[34px] px-2 py-1.5" : "flex-col p-3"} items-center justify-center rounded-lg border text-xs font-medium transition-all ${
                isActive
                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500/20"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
              style={isActive ? { borderColor: "var(--color-accent)", color: "var(--color-accent)" } : { backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
            >
              {opt.icon && <span className={compact ? "mr-1.5" : "mb-1"}>{opt.icon}</span>}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 8. Elementor-style Background Picker
export function BackgroundPicker({ label, description, value = {}, onChange, themeVars = null }) {
  const v = {
    type: "classic",
    color: "",
    color2: "",
    stops: null,
    gradientType: "linear",
    angle: 180,
    mix: 50,
    softness: 100,
    ...value
  };
  const stops = Array.isArray(v.stops) && v.stops.length
    ? v.stops
    : [
        { color: v.color || "#6366f1", position: 0 },
        { color: v.color2 || "#111827", position: 100 },
      ];
  const updateStops = (nextStops) => {
    const normalized = nextStops
      .map((stop, index) => ({
        color: stop.color || (index === 0 ? (v.color || "#6366f1") : (v.color2 || "#111827")),
        position: Math.max(0, Math.min(100, Number(stop.position ?? Math.round((index / Math.max(1, nextStops.length - 1)) * 100)))),
      }))
      .sort((a, b) => a.position - b.position);
    onChange({
      ...v,
      stops: normalized,
      color: normalized[0]?.color || v.color,
      color2: normalized[normalized.length - 1]?.color || v.color2,
    });
  };

  return (
    <div className="mb-5 border rounded-lg p-3 shadow-sm bg-gray-50/50" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-2)" }}>
      <ControlLabel label={label || "Background"} description={description} />
      
      {/* Type Toggle: Classic vs Gradient */}
      <div className="flex gap-1 bg-gray-200 p-1 rounded-md w-max mb-4 mt-2" style={{ backgroundColor: "var(--color-surface)" }}>
        <button 
          type="button" 
          onClick={() => onChange({ ...v, type: "classic" })}
          className={`px-3 py-1 text-xs rounded transition-all ${v.type === "classic" ? "bg-white shadow" : "text-gray-500 hover:text-gray-700"}`}
          style={v.type === "classic" ? { backgroundColor: "var(--color-bg)", color: "var(--color-text-primary)" } : {}}
        >
          Classic
        </button>
        <button 
          type="button" 
          onClick={() => onChange({ ...v, type: "gradient" })}
          className={`px-3 py-1 text-xs rounded transition-all ${v.type === "gradient" ? "bg-white shadow" : "text-gray-500 hover:text-gray-700"}`}
          style={v.type === "gradient" ? { backgroundColor: "var(--color-bg)", color: "var(--color-text-primary)" } : {}}
        >
          Gradient
        </button>
      </div>

      {v.type === "classic" ? (
        <ColorPicker label="Color" value={v.color} onChange={(c) => onChange({ ...v, color: c })} themeVars={themeVars} />
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--color-text-secondary)" }}>Colors</span>
              <button
                type="button"
                onClick={() => {
                  const nextPosition = stops.length
                    ? Math.min(100, Math.max(0, Math.round((stops[stops.length - 1].position + stops[0].position) / 2)))
                    : 50;
                  updateStops([...stops, { color: "#ffffff", position: nextPosition }]);
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-accent)", backgroundColor: "var(--color-surface)" }}
                title="Add gradient color"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {stops.map((stop, index) => (
                <div key={index} className="grid grid-cols-[1fr_72px_28px] items-end gap-2">
                  <ColorPicker
                    label={`Color ${index + 1}`}
                    value={stop.color}
                    onChange={(c) => updateStops(stops.map((s, i) => i === index ? { ...s, color: c } : s))}
                    themeVars={themeVars}
                  />
                  <div className="mb-5">
                    <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--color-text-secondary)" }}>Stop</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={stop.position}
                      onChange={(e) => updateStops(stops.map((s, i) => i === index ? { ...s, position: Number(e.target.value) } : s))}
                      className="h-9 w-full rounded-md border px-2 text-xs outline-none"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => stops.length > 2 && updateStops(stops.filter((_, i) => i !== index))}
                    disabled={stops.length <= 2}
                    className="mb-5 inline-flex h-9 w-7 items-center justify-center rounded-md border disabled:opacity-35"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-danger, #ef4444)", backgroundColor: "var(--color-surface)" }}
                    title="Remove color"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-gray-500" style={{ color: "var(--color-text-secondary)" }}>Type</span>
            <div className="flex gap-4">
              <label className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: "var(--color-text-primary)" }}>
                <input type="radio" checked={v.gradientType === "linear"} onChange={() => onChange({ ...v, gradientType: "linear" })} className="accent-blue-500" /> Linear
              </label>
              <label className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: "var(--color-text-primary)" }}>
                <input type="radio" checked={v.gradientType === "radial"} onChange={() => onChange({ ...v, gradientType: "radial" })} className="accent-blue-500" /> Radial
              </label>
            </div>
          </div>
          
          {v.gradientType === "linear" && (
            <SliderControl label="Angle" min={0} max={360} value={v.angle} onChange={(a) => onChange({ ...v, angle: a })} unit="deg" />
          )}
          <SliderControl
            label="Color Ratio"
            description="Where the dominant color transition sits"
            min={0}
            max={100}
            value={v.mix}
            onChange={(mix) => onChange({ ...v, mix })}
            unit="%"
          />
          <SliderControl
            label="Softness"
            description="How soft or sharp the blend transition is"
            min={0}
            max={100}
            value={v.softness}
            onChange={(softness) => onChange({ ...v, softness })}
            unit="%"
          />
        </div>
      )}
    </div>
  );
}

// 9. Elementor-style Border Picker
export function BorderPicker({ label, description, value = {}, onChange, themeVars = null }) {
  const v = { type: "none", width: { top: 0, right: 0, bottom: 0, left: 0 }, color: "", ...value };

  return (
    <div className="mb-5 border rounded-lg p-3 shadow-sm" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-2)" }}>
      <ControlLabel label={label || "Border"} description={description} />
      
      <div className="mb-2 mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400 shrink-0" style={{ color: "var(--color-text-secondary)" }}>Border Type</span>
        <select 
          value={v.type} 
          onChange={(e) => onChange({ ...v, type: e.target.value })}
          className="border rounded px-2 py-1 text-[11px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-w-[120px]"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
        >
          <option value="none">None</option>
          <option value="solid">Solid</option>
          <option value="double">Double</option>
          <option value="dotted">Dotted</option>
          <option value="dashed">Dashed</option>
        </select>
      </div>

      {v.type !== "none" && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
          <MarginBox label="Width" value={v.width} onChange={(w) => onChange({ ...v, width: w })} />
          <ColorPicker label="Color" value={v.color} onChange={(c) => onChange({ ...v, color: c })} themeVars={themeVars} />
        </div>
      )}
    </div>
  );
}
