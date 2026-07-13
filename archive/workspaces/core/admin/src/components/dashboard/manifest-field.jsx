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
      className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
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
      className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
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
        className="w-9 h-9 rounded-lg border cursor-pointer p-0.5"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
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
      className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
    />
  );
}

function TimezoneInput({ value, onChange }) {
  // Generate timezone list with offsets once
  const [tzOptions] = useState(() => {
    try {
      const zones = Intl.supportedValuesOf('timeZone');
      return zones.map(tz => {
        const date = new Date();
        const tzStr = date.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
        const match = tzStr.match(/GMT([+-][0-9:]+)?/);
        let offset = 'UTC+0:00';
        if (match && match[1]) {
          offset = 'UTC' + match[1];
        } else if (match && !match[1]) {
          offset = 'UTC+0:00';
        }
        let cleanName = tz.replace('Calcutta', 'Kolkata');
        return { tz: cleanName, label: `${cleanName} (${offset})` };
      });
    } catch (e) {
      return [];
    }
  });

  const [dlId] = useState(() => `tz-datalist-${Math.random().toString(36).slice(2, 8)}`);

  return (
    <div>
      <input
        type="text"
        list={dlId}
        value={value ?? ""}
        placeholder="System Default"
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
      />
      <datalist id={dlId}>
        {tzOptions.map(opt => (
          <option key={opt.tz} value={opt.tz}>{opt.label}</option>
        ))}
      </datalist>
    </div>
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
      className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useState(null)[1];

  const filtered = mediaFiles.filter((f) => {
    if (!accepts) return true;
    if (!f.mime_type) return true;
    if (accepts.endsWith("/*"))
      return f.mime_type.startsWith(accepts.replace("/*", "/"));
    return f.mime_type === accepts;
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/media/upload", { method: "POST", body: form });
      if (r.ok) {
        const data = await r.json();
        // Set the URL to the uploaded file
        const url = data.url || `/media/${file.name}`;
        onChange(url);
        setOpen(false);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {/* Current preview */}
      {value && accepts?.startsWith("image") && (
        <div
          className="mb-2 rounded-lg overflow-hidden border"
          style={{ borderColor: "var(--color-border)" }}
        >
          <img
            src={value}
            alt=""
            className="w-full h-24 object-cover"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      )}

      {/* Picker button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between transition-colors"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
          color: value ? "var(--color-text-primary)" : "var(--color-text-muted)",
        }}
      >
        <span className="truncate">
          {value ? value.split("/").pop() : "Choose image..."}
        </span>
        <ImagePlus size={14} className="shrink-0 ml-2" style={{ color: "var(--color-text-muted)" }} />
      </button>

      {open && (
        <div
          className="mt-2 border rounded-lg max-h-64 overflow-y-auto"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          {/* Upload option */}
          <label
            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors text-sm font-medium border-b"
            style={{
              color: "var(--color-accent)",
              borderColor: "var(--color-border)",
            }}
          >
            <ImagePlus size={14} />
            {uploading ? "Uploading..." : "Upload new file"}
            <input
              type="file"
              accept={accepts || "*"}
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>

          {/* Existing files */}
          {filtered.length === 0 ? (
            <div
              className="px-3 py-4 text-xs text-center"
              style={{ color: "var(--color-text-muted)" }}
            >
              No files uploaded yet
            </div>
          ) : (
            filtered.map((f) => (
              <button
                key={f.id || f.filename}
                type="button"
                onClick={() => {
                  onChange(f.url);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-3"
                style={{
                  backgroundColor:
                    value === f.url ? "var(--color-accent-bg)" : "transparent",
                  color: "var(--color-text-primary)",
                }}
              >
                {f.mime_type?.startsWith("image/") && (
                  <img
                    src={f.url}
                    alt=""
                    className="w-8 h-8 rounded object-cover shrink-0"
                  />
                )}
                <span className="truncate text-xs">{f.filename}</span>
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
              className="w-full text-left px-3 py-2 text-xs border-t transition-colors"
              style={{
                color: "var(--color-danger)",
                borderColor: "var(--color-border)",
              }}
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
            <label className="block text-sm" style={{ color: "var(--color-text-primary)" }}>{field.label}</label>
            {field.hint && (
              <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-0.5">{field.hint}</p>
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
    case "timezone":
      control = <TimezoneInput value={value} onChange={onChange} />;
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
