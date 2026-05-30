import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { 
  ColorPicker, 
  SliderControl, 
  ToggleSwitch, 
  SelectDropdown, 
  RadioCards 
} from "./controls";

function TextInput({ value, onChange, placeholder, label, hint }) {
  return (
    <div className="mb-5">
      <div className="mb-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500" style={{ color: "var(--color-text-secondary)" }}>
          {label}
        </label>
        {hint && <p className="text-[10px] mt-0.5 text-gray-400" style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
      </div>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all shadow-sm"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
      />
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, label, hint }) {
  return (
    <div className="mb-5">
      <div className="mb-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500" style={{ color: "var(--color-text-secondary)" }}>
          {label}
        </label>
        {hint && <p className="text-[10px] mt-0.5 text-gray-400" style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
      </div>
      <input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all shadow-sm"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
      />
    </div>
  );
}

function TimeInput({ value, onChange, label, hint }) {
  return (
    <div className="mb-5">
      <div className="mb-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500" style={{ color: "var(--color-text-secondary)" }}>
          {label}
        </label>
        {hint && <p className="text-[10px] mt-0.5 text-gray-400" style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
      </div>
      <input
        type="time"
        value={value || "00:00"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 shadow-sm"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
      />
    </div>
  );
}

function TimezoneInput({ value, onChange, label, hint }) {
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
    <div className="mb-5">
      <div className="mb-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500" style={{ color: "var(--color-text-secondary)" }}>
          {label}
        </label>
        {hint && <p className="text-[10px] mt-0.5 text-gray-400" style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
      </div>
      <input
        type="text"
        list={dlId}
        value={value ?? ""}
        placeholder="System Default"
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 shadow-sm"
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
    <div className="mb-5">
      <div className="mb-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500" style={{ color: "var(--color-text-secondary)" }}>
          File / Image
        </label>
      </div>
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

export default function ManifestField({ field, value, onChange, mediaFiles }) {
  switch (field.type) {
    case "text":
      return (
        <TextInput
          label={field.label}
          hint={field.hint}
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
    case "number":
      return (
        <NumberInput
          label={field.label}
          hint={field.hint}
          value={value}
          onChange={onChange}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );
    case "slider":
      return (
        <SliderControl
          label={field.label}
          description={field.hint}
          value={value}
          onChange={onChange}
          min={field.min}
          max={field.max}
          unit={field.unit}
        />
      );
    case "toggle":
      return (
        <ToggleSwitch
          label={field.label}
          description={field.hint}
          value={value}
          onChange={onChange}
        />
      );
    case "color":
      return <ColorPicker label={field.label} description={field.hint} value={value} onChange={onChange} />;
    case "time":
      return <TimeInput label={field.label} hint={field.hint} value={value} onChange={onChange} />;
    case "timezone":
      return <TimezoneInput label={field.label} hint={field.hint} value={value} onChange={onChange} />;
    case "select":
      return (
        <SelectDropdown
          label={field.label}
          description={field.hint}
          value={value}
          onChange={onChange}
          options={field.options}
        />
      );
    case "radio":
      return (
        <RadioCards
          label={field.label}
          description={field.hint}
          value={value}
          onChange={onChange}
          options={field.options}
        />
      );
    case "file":
      return (
        <FileInput
          value={value}
          onChange={onChange}
          accepts={field.accepts}
          mediaFiles={mediaFiles}
        />
      );
    default:
      return <TextInput label={field.label} hint={field.hint} value={value} onChange={onChange} />;
  }
}
