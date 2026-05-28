// Auto-renders any field type from a widget manifest's configSchema.
// This is the keystone of the modular widget system: widget authors
// describe their config fields in JSON, and the admin panel renders them
// automatically with full validation.
import { useState } from "react";
import { FieldLabel } from "./ui-primitives";
import { ImagePlus } from "lucide-react";

function NumberInput({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    />
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    />
  );
}

function SliderInput({ value, onChange, min = 0, max = 100, unit = "" }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400 font-mono">
          {value}
          {unit}
        </span>
        <span className="text-xs text-gray-300 font-mono">
          {min} – {max}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value ?? min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
    </div>
  );
}

function ToggleInput({ value, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex items-center w-10 h-6 rounded-full transition-colors ${
        value ? "bg-[#2563EB]" : "bg-gray-200"
      }`}
      aria-pressed={value}
      aria-label={label}
    >
      <span
        className={`inline-block w-5 h-5 bg-white rounded-full shadow transition-transform ${
          value ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ColorInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#FFFFFF"}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
      />
      <TextInput value={value} onChange={onChange} placeholder="#FFFFFF" />
    </div>
  );
}

function TimeInput({ value, onChange }) {
  return (
    <input
      type="time"
      value={value || "00:00"}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    />
  );
}

function SelectInput({ value, onChange, options = [] }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        onChange(opt ? opt.value : e.target.value);
      }}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 bg-white"
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function RadioInput({ value, onChange, options = [] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = String(opt.value) === String(value);
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isActive
                ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function FileInput({ value, onChange, accepts, mediaFiles = [] }) {
  const [open, setOpen] = useState(false);

  const filtered = mediaFiles.filter((f) => {
    if (!accepts) return true;
    if (!f.mime_type) return true;
    if (accepts.endsWith("/*"))
      return f.mime_type.startsWith(accepts.replace("/*", "/"));
    return f.mime_type === accepts;
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between hover:border-gray-300 transition-colors"
      >
        <span className={value ? "text-gray-900 truncate" : "text-gray-400"}>
          {value ? value.split("/").pop() : "Choose from media library"}
        </span>
        <ImagePlus size={14} className="text-gray-400 shrink-0 ml-2" />
      </button>
      {open && (
        <div className="mt-2 border border-gray-200 rounded-lg bg-white max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-400 text-center">
              No files yet — upload some in the Media tab
            </div>
          ) : (
            filtered.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onChange(f.url);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                  value === f.url ? "bg-blue-50" : ""
                }`}
              >
                {f.mime_type?.startsWith("image/") && (
                  <img
                    src={f.url}
                    alt=""
                    className="w-8 h-8 rounded object-cover"
                  />
                )}
                <span className="truncate text-xs text-gray-700">
                  {f.filename}
                </span>
              </button>
            ))
          )}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-t border-gray-100"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders one config field from a manifest.configSchema entry.
 * Field types: text, number, slider, toggle, color, time, select, radio, file
 */
export default function ManifestField({ field, value, onChange, mediaFiles }) {
  let control;
  switch (field.type) {
    case "text":
      control = (
        <TextInput
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
      break;
    case "number":
      control = (
        <NumberInput
          value={value}
          onChange={onChange}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );
      break;
    case "slider":
      control = (
        <SliderInput
          value={value}
          onChange={onChange}
          min={field.min}
          max={field.max}
          unit={field.unit}
        />
      );
      break;
    case "toggle":
      return (
        <div className="flex items-center justify-between py-1">
          <div>
            <label className="block text-sm text-gray-900">{field.label}</label>
            {field.hint && (
              <p className="text-xs text-gray-400 mt-0.5">{field.hint}</p>
            )}
          </div>
          <ToggleInput value={value} onChange={onChange} label={field.label} />
        </div>
      );
    case "color":
      control = <ColorInput value={value} onChange={onChange} />;
      break;
    case "time":
      control = <TimeInput value={value} onChange={onChange} />;
      break;
    case "select":
      control = (
        <SelectInput
          value={value}
          onChange={onChange}
          options={field.options}
        />
      );
      break;
    case "radio":
      control = (
        <RadioInput value={value} onChange={onChange} options={field.options} />
      );
      break;
    case "file":
      control = (
        <FileInput
          value={value}
          onChange={onChange}
          accepts={field.accepts}
          mediaFiles={mediaFiles}
        />
      );
      break;
    default:
      control = <TextInput value={value} onChange={onChange} />;
  }

  return (
    <div>
      <FieldLabel hint={field.hint}>{field.label}</FieldLabel>
      {control}
    </div>
  );
}
