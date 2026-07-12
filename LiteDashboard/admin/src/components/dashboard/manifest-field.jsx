import { useState, useRef, useEffect, useMemo } from "react";
import { ImagePlus, Search, Trash2, Check, X, Pencil, Eye, Info } from "lucide-react";
import { 
  ColorPicker, 
  SliderControl, 
  ToggleSwitch, 
  SelectDropdown, 
  PreviewSelectDropdown,
  RadioCards,
  MarginBox,
  BackgroundPicker,
  BorderPicker
} from "./controls";
import { compressImage } from "../../utils/ImageCompressor";

function prettifyFontLabel(fontValue) {
  return String(fontValue || "")
    .split(",")[0]
    .trim()
    .replace(/^["']|["']$/g, "");
}

function FieldLabelBlock({ label, hint, hintDisplay = "text" }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500" style={{ color: "var(--color-text-secondary)" }}>
          {label}
        </label>
        {hint ? (
          <span title={hint} style={{ color: "var(--color-text-muted)" }}>
            <Info size={12} />
          </span>
        ) : null}
      </div>
      {hint && hintDisplay !== "icon" ? <p className="text-[10px] mt-0.5 text-gray-400" style={{ color: "var(--color-text-muted)" }}>{hint}</p> : null}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, label, hint, hintDisplay }) {
  return (
    <div className="mb-5">
      <FieldLabelBlock label={label} hint={hint} hintDisplay={hintDisplay} />
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

function TextAreaInput({ value, onChange, placeholder, label, hint, hintDisplay, rows = 5 }) {
  return (
    <div className="mb-5">
      <FieldLabelBlock label={label} hint={hint} hintDisplay={hintDisplay} />
      <textarea
        value={value ?? ""}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-all shadow-sm resize-y"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
      />
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, label, hint, hintDisplay }) {
  return (
    <div className="mb-5">
      <FieldLabelBlock label={label} hint={hint} hintDisplay={hintDisplay} />
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

function TimeInput({ value, onChange, label, hint, hintDisplay }) {
  return (
    <div className="mb-5">
      <FieldLabelBlock label={label} hint={hint} hintDisplay={hintDisplay} />
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

function TimezoneInput({ value, onChange, label, hint, hintDisplay }) {
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
      <FieldLabelBlock label={label} hint={hint} hintDisplay={hintDisplay} />
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

function formatLocationLabel(item) {
  if (!item || typeof item !== "object") return "";
  const parts = [item.name, item.admin1, item.country].filter(Boolean);
  return parts.join(", ");
}

function LocationSearchInput({ value, onChange, label, hint, hintDisplay, placeholder }) {
  const [query, setQuery] = useState(formatLocationLabel(value));
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery(formatLocationLabel(value));
    }
  }, [value, open]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const nextQuery = query.trim();
    if (!open || nextQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/weather/search?q=${encodeURIComponent(nextQuery)}`);
        const data = response.ok ? await response.json() : { results: [] };
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query, open]);

  return (
    <div className="mb-5" ref={wrapRef}>
      <FieldLabelBlock label={label} hint={hint} hintDisplay={hintDisplay} />
      <div className="relative">
        <div
          className="flex items-center gap-2 border rounded-lg px-3 py-2 shadow-sm"
          style={{ backgroundColor: "var(--color-surface)", borderColor: open ? "var(--color-accent)" : "var(--color-border)" }}
        >
          <Search size={14} style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            value={query}
            placeholder={placeholder || "Start typing a city..."}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text-primary)" }}
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setQuery("");
                setResults([]);
                setOpen(false);
              }}
              className="shrink-0"
              title="Clear location"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        {value ? (
          <div className="mt-1.5 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            {formatLocationLabel(value)}
            {typeof value?.latitude === "number" && typeof value?.longitude === "number"
              ? ` · ${value.latitude.toFixed(2)}, ${value.longitude.toFixed(2)}`
              : ""}
          </div>
        ) : null}

        {open ? (
          <div
            className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border shadow-2xl overflow-hidden"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
          >
            {loading ? (
              <div className="px-3 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                Searching locations...
              </div>
            ) : results.length > 0 ? (
              <div className="max-h-64 overflow-y-auto p-2">
                {results.map((item) => {
                  const itemLabel = formatLocationLabel(item);
                  const active = itemLabel === formatLocationLabel(value);
                  return (
                    <button
                      key={`${item.latitude}:${item.longitude}:${itemLabel}`}
                      type="button"
                      onClick={() => {
                        onChange(item);
                        setQuery(itemLabel);
                        setOpen(false);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                      style={{
                        backgroundColor: active ? "var(--color-accent-bg)" : "transparent",
                        color: active ? "var(--color-accent)" : "var(--color-text-primary)",
                      }}
                    >
                      <div className="text-sm truncate">{item.name}</div>
                      <div className="text-[11px] truncate" style={{ color: active ? "inherit" : "var(--color-text-muted)" }}>
                        {[item.admin1, item.country].filter(Boolean).join(", ")}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                {query.trim().length < 2 ? "Type at least 2 letters." : "No locations found."}
              </div>
            )}
          </div>
        ) : null}
      </div>
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
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploading(true);
    try {
      const file = await compressImage(rawFile);
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

function MediaListPicker({ value, onChange, accepts, mediaFiles, label, hint, compact = false }) {
  const [open, setOpen] = useState(false);
  const [localMedia, setLocalMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busyDelete, setBusyDelete] = useState("");
  const [busyRename, setBusyRename] = useState("");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedFirst, setSelectedFirst] = useState(true);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);
  const [previewTarget, setPreviewTarget] = useState(null);
  const uploadRef = useRef(null);
  const renameInputRef = useRef(null);

  const audioOnly = accepts && accepts.startsWith("audio/");
  useEffect(() => { if (audioOnly) setViewMode("list"); }, [audioOnly]);

  useEffect(() => {
    if (!open) return;
    function onEsc(e) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.dataset.mediaSelectorOpen = open ? "true" : "false";
    window.dispatchEvent(new CustomEvent("pi-media-selector-toggle", { detail: { open } }));
    return () => {
      document.body.dataset.mediaSelectorOpen = "false";
      window.dispatchEvent(new CustomEvent("pi-media-selector-toggle", { detail: { open: false } }));
    };
  }, [open]);

  useEffect(() => {
    if (!renameTarget || !renameInputRef.current) return;
    renameInputRef.current.focus();
    renameInputRef.current.select();
  }, [renameTarget]);

  async function loadMedia() {
    try {
      const r = await fetch("/api/media");
      const data = r.ok ? await r.json() : { files: [] };
      const raw = Array.isArray(data?.files) ? data.files : [];
      const mm = { jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",webp:"image/webp",svg:"image/svg+xml",mp4:"video/mp4",webm:"video/webm",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",flac:"audio/flac",aac:"audio/aac",m4a:"audio/mp4" };
      setLocalMedia(raw.map((f) => {
        const ext = String(f.filename || "").split(".").pop().toLowerCase();
        return { filename: f.filename, url: f.url, size: f.size, mime_type: f.mime_type || mm[ext] || "application/octet-stream" };
      }));
    } catch {
      setLocalMedia([]);
    }
  }

  const selected = useMemo(() => String(value || "").split(",").map((s) => s.trim()).filter(Boolean), [value]);

  const allMedia = useMemo(() => {
    const fromProps = Array.isArray(mediaFiles) ? mediaFiles : [];
    const map = new Map();
    for (const f of [...fromProps, ...localMedia]) map.set(f.url, f);
    return Array.from(map.values());
  }, [mediaFiles, localMedia]);

  const prepared = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allMedia
      .filter((f) => {
        if (accepts && f.mime_type) {
          if (accepts.endsWith("/*")) {
            if (!f.mime_type.startsWith(accepts.replace("/*", "/"))) return false;
          } else if (f.mime_type !== accepts) return false;
        }
        if (!q) return true;
        return String(f.filename || "").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (selectedFirst) {
          const as = selected.includes(a.url) ? 1 : 0;
          const bs = selected.includes(b.url) ? 1 : 0;
          if (as !== bs) return bs - as;
        }
        if (sortBy === "size-asc") return (a.size || 0) - (b.size || 0);
        if (sortBy === "size-desc") return (b.size || 0) - (a.size || 0);
        if (sortBy === "name-desc") return String(b.filename || "").localeCompare(String(a.filename || ""));
        return String(a.filename || "").localeCompare(String(b.filename || ""));
      });
  }, [allMedia, query, accepts, sortBy, selectedFirst, selected]);

  function toggle(url) {
    const next = selected.includes(url) ? selected.filter((u) => u !== url) : selected.concat([url]);
    onChange(next.join(", "));
  }

  async function deleteFile(url) {
    const filename = decodeURIComponent(String(url || "").split("/").pop() || "");
    if (!filename || !window.confirm(`Delete "${filename}"?`)) return;
    setBusyDelete(filename);
    try {
      const r = await fetch(`/api/media/${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Delete failed");
      onChange(selected.filter((u) => u !== url).join(", "));
      await loadMedia();
    } catch (e) {
      window.alert(`Delete failed: ${e.message || "unknown error"}`);
    } finally {
      setBusyDelete("");
    }
  }

  function beginRename(url) {
    const oldName = decodeURIComponent(String(url || "").split("/").pop() || "");
    if (!oldName) return;
    setRenameTarget({ url, filename: oldName });
    setRenameDraft(oldName);
  }

  async function commitRename() {
    const oldName = renameTarget?.filename;
    const url = renameTarget?.url;
    const next = renameDraft.trim();
    if (!oldName || !url) return;
    if (!next || next === oldName) {
      setRenameTarget(null);
      setRenameDraft("");
      return;
    }
    setBusyRename(oldName);
    try {
      const r = await fetch(`/api/media/${encodeURIComponent(oldName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: next }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Rename failed");
      const data = await r.json();
      const replaced = selected.map((u) => (u === url ? data.url : u));
      onChange(replaced.join(", "));
      await loadMedia();
      setRenameTarget(null);
      setRenameDraft("");
    } catch (e) {
      window.alert(`Rename failed: ${e.message || "unknown error"}`);
    } finally {
      setBusyRename("");
    }
  }

  async function handleUpload(files) {
    if (!files || !files.length) return;
    setUploading(true);
    const list = Array.from(files);
    let nextSelected = [...selected];
    for (const original of list) {
      try {
        const file = original.type && original.type.startsWith("image/") ? await compressImage(original) : original;
        const form = new FormData();
        form.append("file", file);
        const r = await fetch("/api/media/upload", { method: "POST", body: form });
        const res = await r.json().catch(() => ({}));
        if (r.ok && res?.url) {
          if (!nextSelected.includes(res.url)) {
            nextSelected.push(res.url);
          }
        }
      } catch {
        // continue uploading remaining files
      }
    }
    onChange(nextSelected.join(", "));
    await loadMedia();
    setUploading(false);
  }

  function openSelector() {
    setQuery("");
    setOpen(true);
    loadMedia();
  }

  const inputAccept = accepts || "image/*,audio/*,video/*";
  const selectedPreview = selected.slice(0, 4).map((url) => allMedia.find((f) => f.url === url)).filter(Boolean);
  const isMobileViewport = typeof window !== "undefined" ? window.innerWidth < 768 : false;

  return (
    <div className={compact ? "mb-3" : "mb-5"}>
      <div className={compact ? "mb-1.5" : "mb-2"}>
        <label className={compact ? "block text-[10px] font-semibold uppercase tracking-wide" : "block text-[11px] font-semibold uppercase tracking-wider"} style={{ color: "var(--color-text-secondary)" }}>
          {label || "Media files"}
        </label>
        {hint && <p className={compact ? "text-[9px] mt-0.5 leading-4" : "text-[10px] mt-0.5"} style={{ color: "var(--color-text-muted)" }}>{hint}</p>}
      </div>

      <button type="button" onClick={openSelector} className={`w-full border rounded-lg transition-colors ${compact ? "px-2 py-1.5 text-[11px]" : "px-2.5 py-2 text-xs"}`}
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
        <div className="flex items-center justify-between">
          <span>{selected.length} selected</span>
          <span className={compact ? "text-[9px] px-1.5 py-0.5 rounded-full leading-none" : "text-[10px] px-2 py-0.5 rounded-full"} style={{ backgroundColor: "var(--color-accent-bg)", color: "var(--color-accent)" }}>Open selector</span>
        </div>
        {selectedPreview.length > 0 && (
          <div className={compact ? "mt-1 flex flex-wrap gap-1" : "mt-2 flex gap-1.5"}>
            {selectedPreview.map((f, idx) => (
              <div key={`${f.url}-${idx}`} className={compact ? "w-6 h-6 rounded border overflow-hidden" : "w-8 h-8 rounded border overflow-hidden"} style={{ borderColor: "var(--color-border)" }}>
                {String(f.mime_type || "").startsWith("image/") ? (
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {String(f.mime_type || "").startsWith("video/") ? "VID" : "AUD"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[20000] isolate">
          <div className="absolute inset-0 bg-black/88" onClick={() => setOpen(false)} />
          <div
            className="absolute left-2 right-2 bottom-2 border rounded-lg overflow-hidden flex flex-col md:left-4 md:right-4 md:bottom-4"
            style={{
              top: "calc(env(safe-area-inset-top, 0px) + 76px)",
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: "var(--color-border)" }}>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Media Selector</div>
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{selected.length} selected</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded border" style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
                <X size={14} />
              </button>
            </div>

            <div className="px-3 py-3 border-b flex items-center gap-2 flex-wrap md:px-4" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex-1 min-w-[240px] relative">
                <Search size={14} className="absolute left-2 top-2.5" style={{ color: "var(--color-text-muted)" }} />
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by filename..."
                  className="w-full border rounded-lg pl-8 pr-3 py-2 text-xs focus-visible:outline-none"
                  style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-2)", color: "var(--color-text-primary)" }} />
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border rounded-lg px-2 py-2 text-xs"
                style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-2)", color: "var(--color-text-primary)" }}>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="size-asc">Size Low-High</option>
                <option value="size-desc">Size High-Low</option>
              </select>
              <button type="button" onClick={() => setSelectedFirst((v) => !v)} className="border rounded-lg px-3 py-2 text-xs"
                style={{ borderColor: "var(--color-border)", color: selectedFirst ? "var(--color-accent)" : "var(--color-text-secondary)" }}>
                Selected first
              </button>
              {!audioOnly && (
                <button type="button" onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))} className="border rounded-lg px-3 py-2 text-xs"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
                  {viewMode === "grid" ? "List view" : "Grid view"}
                </button>
              )}
              <button type="button" onClick={() => uploadRef.current && uploadRef.current.click()} disabled={uploading}
                className="border rounded-lg px-3 py-2 text-xs" style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)", backgroundColor: "var(--color-accent-bg)", opacity: uploading ? 0.6 : 1 }}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
              <input ref={uploadRef} type="file" multiple accept={inputAccept} className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4">
              {prepared.length === 0 ? (
                <div className="px-3 py-10 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>No matching files.</div>
              ) : viewMode === "list" || audioOnly ? (
                <div className="space-y-1.5">
                  {prepared.map((f) => {
                    const isSel = selected.includes(f.url);
                    const isImage = String(f.mime_type || "").startsWith("image/");
                    const isVideo = String(f.mime_type || "").startsWith("video/");
                    const deleting = busyDelete === f.filename;
                    const renaming = busyRename === f.filename;
                    return (
                      <div key={f.filename} className="border rounded-lg px-2.5 py-2 flex items-center gap-2" style={{ borderColor: isSel ? "var(--color-accent)" : "var(--color-border)", backgroundColor: "rgba(255,255,255,0.01)" }}>
                        <button type="button" onClick={() => toggle(f.url)} className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: isSel ? "var(--color-accent)" : "transparent", color: "#fff", border: isSel ? "none" : "1px solid var(--color-border)" }}>
                          {isSel ? <Check size={13} strokeWidth={3} /> : null}
                        </button>
                        {!audioOnly && (
                          <div className="shrink-0 w-16 aspect-video rounded-md overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                            {isImage ? (
                              <img src={f.url} alt="" className="w-full h-full object-cover" />
                            ) : isVideo ? (
                              <video src={f.url} className="w-full h-full object-cover" muted playsInline />
                            ) : null}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate" style={{ color: "var(--color-text-primary)" }}>{f.filename}</div>
                          <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{(f.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!audioOnly && (
                            <button type="button" onClick={() => setPreviewTarget(f)} className="w-8 h-8 rounded-md flex items-center justify-center"
                              title="Preview"
                              style={{ color: "var(--color-text-primary)" }}>
                              <Eye size={15} />
                            </button>
                          )}
                          <button type="button" onClick={() => beginRename(f.url)} disabled={renaming} className="w-8 h-8 rounded-md flex items-center justify-center"
                            title="Rename"
                            style={{ color: "var(--color-text-primary)", opacity: renaming ? 0.5 : 1 }}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" onClick={() => deleteFile(f.url)} disabled={deleting} className="w-8 h-8 rounded-md flex items-center justify-center"
                            title="Delete"
                            style={{ color: "var(--color-danger)", opacity: deleting ? 0.5 : 1 }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))" }}>
                  {prepared.map((f) => {
                    const isSel = selected.includes(f.url);
                    const isImage = String(f.mime_type || "").startsWith("image/");
                    const isVideo = String(f.mime_type || "").startsWith("video/");
                    const deleting = busyDelete === f.filename;
                    const renaming = busyRename === f.filename;
                    return (
                      <div key={f.filename} className="group"
                        style={{ backgroundColor: "transparent" }}>
                        <button type="button" onClick={() => toggle(f.url)} className="relative block w-full">
                          {isSel && (
                            <div
                              className="absolute left-1.5 top-1.5 z-10 w-6 h-6 rounded-[8px] flex items-center justify-center shadow-sm"
                              style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
                            >
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                          <div className="relative aspect-video w-full rounded-lg overflow-hidden border bg-black/20"
                            style={{ borderColor: isSel ? "var(--color-accent)" : "var(--color-border)" }}>
                            {isImage ? (
                              <img src={f.url} alt="" className="w-full h-full object-cover" />
                            ) : isVideo ? (
                              <video src={f.url} className="w-full h-full object-cover" muted playsInline />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl" style={{ color: "var(--color-text-muted)" }}>AUDIO</div>
                            )}
                            <div
                              className="absolute inset-x-0 bottom-0 p-2 opacity-0 md:group-hover:opacity-100 transition-opacity"
                              style={{ background: "linear-gradient(to top, rgba(8,12,24,0.58), rgba(8,12,24,0.02))" }}
                            >
                              <div className="flex items-center justify-between gap-2 text-[10px]">
                                <span className="truncate" style={{ color: "rgba(255,255,255,0.72)" }}>
                                  {(f.size / 1024).toFixed(0)} KB
                                </span>
                                <div className="flex items-center gap-1">
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewTarget(f); }}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setPreviewTarget(f); } }}
                                    title="Preview"
                                    className="w-7 h-7 flex items-center justify-center"
                                    style={{ color: "#fff", opacity: 0.95 }}
                                  >
                                    <Eye size={15} />
                                  </span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); beginRename(f.url); }}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); beginRename(f.url); } }}
                                    title="Rename"
                                    className="w-7 h-7 flex items-center justify-center"
                                    style={{ color: "#fff", opacity: renaming ? 0.5 : 0.95 }}
                                  >
                                    <Pencil size={14} />
                                  </span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteFile(f.url); }}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); deleteFile(f.url); } }}
                                    title="Delete"
                                    className="w-7 h-7 flex items-center justify-center"
                                    style={{ color: "#ff8d8d", opacity: deleting ? 0.5 : 0.98 }}
                                  >
                                    <Trash2 size={14} />
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>
                        <div className="px-0 pt-2">
                          <div className="text-xs truncate" style={{ color: "var(--color-text-primary)" }}>{f.filename}</div>
                        </div>
                        {isMobileViewport && (
                          <div className="px-0 pt-1 flex items-center justify-between gap-2 text-[10px]">
                            <span style={{ color: "var(--color-text-muted)" }}>{(f.size / 1024).toFixed(0)} KB</span>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => setPreviewTarget(f)} className="w-8 h-8 rounded-md flex items-center justify-center"
                                title="Preview"
                                style={{ color: "var(--color-text-primary)" }}><Eye size={15} /></button>
                              <button type="button" onClick={() => beginRename(f.url)} disabled={renaming} className="w-8 h-8 rounded-md flex items-center justify-center"
                                title="Rename"
                                style={{ color: "var(--color-text-primary)", opacity: renaming ? 0.5 : 1 }}><Pencil size={14} /></button>
                              <button type="button" onClick={() => deleteFile(f.url)} disabled={deleting} className="w-8 h-8 rounded-md flex items-center justify-center"
                                title="Delete"
                                style={{ color: "var(--color-danger)", opacity: deleting ? 0.5 : 1 }}><Trash2 size={14} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t flex justify-between items-center" style={{ borderColor: "var(--color-border)" }}>
              <button type="button" onClick={() => onChange("")} className="text-xs px-3 py-1.5 rounded border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-danger)" }}>Clear all</button>
              <button type="button" onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded border"
                style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)", backgroundColor: "var(--color-accent-bg)" }}>Done</button>
            </div>
          </div>

          {renameTarget && (
            <div className="absolute inset-0 z-[21000] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/45" onClick={() => { setRenameTarget(null); setRenameDraft(""); }} />
              <div
                className="relative w-full max-w-md rounded-xl border p-4 shadow-xl"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
              >
                <div className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Rename File</div>
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setRenameTarget(null);
                      setRenameDraft("");
                    }
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus-visible:outline-none"
                  style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-2)", color: "var(--color-text-primary)" }}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setRenameTarget(null); setRenameDraft(""); }}
                    className="px-3 py-2 rounded-lg text-sm border"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={commitRename}
                    className="px-3 py-2 rounded-lg text-sm border"
                    style={{ borderColor: "var(--color-accent)", backgroundColor: "var(--color-accent-bg)", color: "var(--color-accent)" }}
                  >
                    Rename
                  </button>
                </div>
              </div>
            </div>
          )}

          {previewTarget && (
            <div className="absolute inset-0 z-[21000] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/72" onClick={() => setPreviewTarget(null)} />
              <div className="relative w-full max-w-5xl rounded-xl border overflow-hidden shadow-2xl"
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border)" }}>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{previewTarget.filename}</div>
                    <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{(previewTarget.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <button type="button" onClick={() => setPreviewTarget(null)} className="p-1.5 rounded border"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
                    <X size={14} />
                  </button>
                </div>
                <div className="bg-black/80">
                  {String(previewTarget.mime_type || "").startsWith("video/") ? (
                    <video src={previewTarget.url} className="w-full max-h-[75vh]" controls autoPlay playsInline />
                  ) : (
                    <img src={previewTarget.url} alt="" className="w-full max-h-[75vh] object-contain" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ManifestField({ field, value, onChange, mediaFiles, compact = false, themeVars = null }) {
  switch (field.type) {
    case "text":
      return (
        <TextInput
          label={field.label}
          hint={field.hint}
          hintDisplay={field.hintDisplay}
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
    case "textarea":
      return (
        <TextAreaInput
          label={field.label}
          hint={field.hint}
          hintDisplay={field.hintDisplay}
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
          rows={field.rows || 5}
        />
      );
    case "number":
      return (
        <NumberInput
          label={field.label}
          hint={field.hint}
          hintDisplay={field.hintDisplay}
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
          hintDisplay={field.hintDisplay}
          value={value}
          onChange={onChange}
          min={field.min}
          max={field.max}
          step={field.step}
          unit={field.unit}
          compact={compact}
        />
      );
    case "boolean":
    case "toggle":
      return (
        <ToggleSwitch
          label={field.label}
          description={field.hint}
          hintDisplay={field.hintDisplay}
          value={value}
          onChange={onChange}
          compact={compact}
        />
      );
    case "color":
      return <ColorPicker label={field.label} description={field.hint} value={value} onChange={onChange} themeVars={themeVars} />;
    case "time":
      return <TimeInput label={field.label} hint={field.hint} hintDisplay={field.hintDisplay} value={value} onChange={onChange} />;
    case "timezone":
      return <TimezoneInput label={field.label} hint={field.hint} hintDisplay={field.hintDisplay} value={value} onChange={onChange} />;
    case "location-search":
      return (
        <LocationSearchInput
          label={field.label}
          hint={field.hint}
          hintDisplay={field.hintDisplay}
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
    case "select": {
      const selOpts = (field.options || []).map(o =>
        typeof o === "string"
          ? {
              value: o,
              label:
                field.key === "fontFamily"
                  ? prettifyFontLabel(o)
                  : o.charAt(0).toUpperCase() + o.slice(1),
            }
          : o
      );
      if (field.key === "fontFamily") {
        return (
          <PreviewSelectDropdown
            label={field.label}
            description={field.hint}
            hintDisplay={field.hintDisplay}
            value={value}
            onChange={onChange}
            options={selOpts}
            previewMode="font"
          />
        );
      }
      return (
        <SelectDropdown
          label={field.label}
          description={field.hint}
          hintDisplay={field.hintDisplay}
          value={value}
          onChange={onChange}
          options={selOpts}
        />
      );
    }
    case "radio": {
      const radOpts = (field.options || []).map(o =>
        typeof o === "string" ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o
      );
      return (
        <RadioCards
          label={field.label}
            description={field.hint}
            hintDisplay={field.hintDisplay}
            value={value}
          onChange={onChange}
          options={radOpts}
          compact={compact}
        />
      );
    }
    case "file":
      return (
        <FileInput
          value={value}
          onChange={onChange}
          accepts={field.accepts}
          mediaFiles={mediaFiles}
        />
      );
    case "media-list":
      return (
        <MediaListPicker
          label={field.label}
          hint={field.hint}
          value={value}
          onChange={onChange}
          accepts={field.accepts}
          mediaFiles={mediaFiles}
          compact={compact}
        />
      );
    case "background":
      return (
        <BackgroundPicker
          label={field.label}
          description={field.hint}
          hintDisplay={field.hintDisplay}
          value={value}
          onChange={onChange}
          themeVars={themeVars}
        />
      );
    case "border":
      return (
        <BorderPicker
          label={field.label}
          description={field.hint}
          hintDisplay={field.hintDisplay}
          value={value}
          onChange={onChange}
          themeVars={themeVars}
        />
      );
    case "box":
    case "margin":
    case "radius":
      return (
        <MarginBox
          label={field.label}
          description={field.hint}
          value={value}
          min={field.type === "radius" ? 0 : Number.NEGATIVE_INFINITY}
          onChange={onChange}
        />
      );
    default:
      return <TextInput label={field.label} hint={field.hint} value={value} onChange={onChange} />;
  }
}
