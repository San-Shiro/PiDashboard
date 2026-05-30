import { useState, useRef, useEffect } from "react";
import { ChevronDown, Minus, Plus, Link2, Unlink } from "lucide-react";

// Shared standard label
function ControlLabel({ label, description }) {
  return (
    <div className="mb-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </label>
      {description && <p className="text-[10px] mt-0.5 text-gray-400" style={{ color: "var(--color-text-muted)" }}>{description}</p>}
    </div>
  );
}

import { HexColorPicker } from "react-colorful";

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#22c55e", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#f43f5e", "#ffffff",
  "#94a3b8", "#475569", "#1e293b", "#000000",
];

// 1. Color Picker (Premium inline popover)
export function ColorPicker({ label, description, value, onChange }) {
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
            backgroundColor: value || "#000000",
            borderColor: "var(--color-border)",
            backgroundImage: !value ? "linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)" : "none",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
          }}
        />
        <span className="flex-1 text-xs font-mono uppercase tracking-wide" style={{ color: "var(--color-text-primary)" }}>
          {value || "None"}
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
            <HexColorPicker color={value || "#000000"} onChange={onChange} />

            {/* Hex input */}
            <div className="flex items-center gap-2 mt-3">
              <div className="w-6 h-6 rounded-md shrink-0 border" style={{ backgroundColor: value || "#000000", borderColor: "var(--color-border)" }} />
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
            <HexColorPicker color={value || "#000000"} onChange={onChange} />
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
export function SliderControl({ label, description, value, onChange, min = 0, max = 100, step = 1, unit = "" }) {
  const val = value ?? min;
  const percentage = ((val - min) / (max - min)) * 100;
  
  return (
    <div className="mb-5">
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
      <div className="flex justify-between items-end mb-2">
        <ControlLabel label={label} description={description} />
        <div className="flex items-center border rounded flex-shrink-0 bg-transparent overflow-hidden shadow-sm h-6" style={{ borderColor: "var(--color-border)" }}>
          <input
            type="number"
            value={val}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="w-12 text-center text-xs font-mono outline-none border-0 m-0 p-0 bg-transparent"
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>
      </div>
      <div className="relative h-6 flex items-center group">
        <div className="absolute w-full h-1.5 bg-gray-200 rounded-full pointer-events-none" style={{ backgroundColor: "var(--color-surface-2)" }}>
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
export function ToggleSwitch({ label, description, value, onChange }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="pr-4">
        <ControlLabel label={label} description={description} />
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors shrink-0 shadow-inner ${
          value ? "bg-blue-500" : "bg-gray-300"
        }`}
        style={value ? { backgroundColor: "var(--color-accent)" } : { backgroundColor: "var(--color-border)" }}
      >
        <span
          className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${
            value ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

// 4. Select Dropdown (Premium minimal design)
export function SelectDropdown({ label, description, value, onChange, options = [] }) {
  return (
    <div className="mb-5">
      <ControlLabel label={label} description={description} />
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

// 5. Margin Box (Top, Right, Bottom, Left with optional linking)
export function MarginBox({ label, description, value = {}, onChange }) {
  const [linked, setLinked] = useState(true);
  
  const v = { top: 0, right: 0, bottom: 0, left: 0, ...value };

  const handleChange = (key, val) => {
    if (linked) {
      onChange({ top: val, right: val, bottom: val, left: val });
    } else {
      onChange({ ...v, [key]: val });
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
      <div className="flex justify-between items-center mb-1">
        <ControlLabel label={label} description={description} />
        <button 
          type="button" 
          onClick={() => setLinked(!linked)}
          className={`p-1 rounded text-xs transition-colors ${linked ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
          title={linked ? "Unlink values" : "Link values together"}
        >
          {linked ? <Link2 size={12} /> : <Unlink size={12} />}
        </button>
      </div>
      
      <div className="flex gap-1">
        {inputs.map(({ key, label }) => (
          <div key={key} className="flex-1 bg-white border rounded-md overflow-hidden flex flex-col shadow-sm" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
            <input
              type="number"
              value={v[key]}
              onChange={(e) => handleChange(key, Number(e.target.value))}
              className="w-full text-center text-xs p-1.5 outline-none border-b font-mono bg-transparent"
              style={{ color: "var(--color-text-primary)", borderColor: "var(--color-surface-2)" }}
            />
            <span className="text-[9px] text-center py-0.5 text-gray-400 font-medium uppercase">{label}</span>
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
export function RadioCards({ label, description, value, onChange, options = [] }) {
  return (
    <div className="mb-5">
      <ControlLabel label={label} description={description} />
      <div className="grid grid-cols-2 gap-2 mt-1.5">
        {options.map((opt) => {
          const isActive = String(opt.value) === String(value);
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all ${
                isActive
                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500/20"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
              style={isActive ? { borderColor: "var(--color-accent)", color: "var(--color-accent)" } : { backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
            >
              {opt.icon && <span className="mb-1">{opt.icon}</span>}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
