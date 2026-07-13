// Media & file manager tab — upload, list, see usage, delete with protection.
import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useUpload from "@/utils/useUpload";
import {
  Card,
  Pill,
  SectionHeader,
  EmptyState,
  Spinner,
  GhostButton,
  PrimaryButton,
} from "../ui-primitives";
import {
  Upload,
  Trash2,
  Image as ImageIcon,
  FileText,
  Lock,
  Copy,
  Check,
} from "lucide-react";

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function CopyUrlButton({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);
  return (
    <button
      onClick={copy}
      title="Copy URL"
      className="p-1.5 rounded-lg transition-colors"
      style={{
        color: copied ? "var(--color-success)" : "var(--color-text-muted)",
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function UsageLabels({ usage }) {
  const active = (usage?.activeUses || []).filter((u) => u.enabled !== false);
  const disabled = (usage?.activeUses || []).filter((u) => u.enabled === false);
  const templates = usage?.inactiveTemplateUses || [];
  const isOrphan =
    active.length === 0 && disabled.length === 0 && templates.length === 0;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {active.map((u, i) => (
        <Pill key={i} tone="blue">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {u.label || u.widget_id}
        </Pill>
      ))}
      {disabled.map((u, i) => (
        <Pill key={i} tone="amber">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {u.label || u.widget_id} (disabled)
        </Pill>
      ))}
      {templates.map((u, i) => (
        <Pill key={i}>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--color-accent)" }}
          />
          Template: {u.template_name}
        </Pill>
      ))}
      {isOrphan && (
        <Pill>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          Unused — safe to delete
        </Pill>
      )}
    </div>
  );
}

function MediaFileRow({ file, onDelete, isDeleting }) {
  const isImage = file.mime_type?.startsWith("image/");
  const inUseByActive =
    (file.usage?.activeUses || []).filter((u) => u.enabled !== false).length >
    0;

  return (
    <div
      className="flex items-center gap-4 px-5 py-3 border-b last:border-0 transition-colors"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div
        className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        {isImage ? (
          <img src={file.url} alt="" className="w-full h-full object-cover" />
        ) : (
          <FileText size={18} style={{ color: "var(--color-text-muted)" }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: "var(--color-text-primary)" }}
        >
          {file.filename}
        </p>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono"
            style={{ color: "var(--color-text-muted)" }}
          >
            {formatSize(file.size_bytes)}
          </span>
          <span style={{ color: "var(--color-border-2)" }}>·</span>
          <span
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {file.mime_type || "unknown"}
          </span>
        </div>
        <UsageLabels usage={file.usage} />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <CopyUrlButton url={file.url} />
        <button
          onClick={onDelete}
          disabled={isDeleting || inUseByActive}
          className="p-2 rounded-lg transition-colors"
          style={{
            color: inUseByActive
              ? "var(--color-border-2)"
              : "var(--color-text-muted)",
            cursor: inUseByActive ? "not-allowed" : "pointer",
          }}
          title={
            inUseByActive
              ? "Cannot delete — in use by an active widget"
              : "Delete file"
          }
        >
          {isDeleting ? (
            <Spinner size={14} />
          ) : inUseByActive ? (
            <Lock size={14} />
          ) : (
            <Trash2 size={14} />
          )}
        </button>
      </div>
    </div>
  );
}

export default function MediaTab() {
  const queryClient = useQueryClient();
  const [upload, { loading: uploading }] = useUpload();
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ["media-files"],
    queryFn: async () => {
      const r = await fetch("/api/media");
      if (!r.ok) throw new Error("media");
      return r.json();
    },
  });

  const registerFile = useMutation({
    mutationFn: async (payload) => {
      const r = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("register");
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["media-files"] }),
  });

  const deleteFile = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/media/${id}`, { method: "DELETE" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "delete failed");
      return body;
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["media-files"] });
    },
    onError: (e) => setError(e.message),
  });

  const handleFiles = useCallback(
    async (fileList) => {
      setError(null);
      for (const file of Array.from(fileList || [])) {
        const result = await upload({ file });
        if (result.error) {
          setError(result.error);
          continue;
        }
        registerFile.mutate({
          filename: file.name,
          url: result.url,
          mime_type: result.mimeType || file.type,
          size_bytes: file.size,
        });
      }
    },
    [upload, registerFile],
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const files = data?.files || [];
  const totalSize = files.reduce((s, f) => s + (f.size_bytes || 0), 0);
  const orphanCount = files.filter(
    (f) =>
      (f.usage?.activeUses || []).length === 0 &&
      (f.usage?.inactiveTemplateUses || []).length === 0,
  ).length;

  return (
    <div>
      <SectionHeader
        title="Media library"
        subtitle="Files used by active widgets are protected from deletion. Copy URL to paste into widget configs."
        action={
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono"
              style={{ color: "var(--color-text-muted)" }}
            >
              {files.length} files · {formatSize(totalSize)}
              {orphanCount > 0 && (
                <span style={{ color: "var(--color-warn)", marginLeft: 4 }}>
                  · {orphanCount} unused
                </span>
              )}
            </span>
            <PrimaryButton
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Spinner size={12} /> : <Upload size={12} />}
              Upload
            </PrimaryButton>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        }
      />

      {error && (
        <div
          className="border rounded-xl px-4 py-3 mb-4 text-sm"
          style={{
            backgroundColor: "var(--color-danger-bg)",
            borderColor: "var(--color-danger)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {isLoading ? (
          <Card className="py-16 flex justify-center">
            <Spinner size={20} />
          </Card>
        ) : files.length === 0 ? (
          <div
            className="border-2 border-dashed rounded-xl py-16 px-6 text-center"
            style={{ borderColor: "var(--color-border)" }}
          >
            <ImageIcon
              size={28}
              className="mx-auto mb-3"
              style={{ color: "var(--color-border-2)" }}
            />
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              No media yet
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Drag and drop or click Upload
            </p>
          </div>
        ) : (
          <Card>
            {files.map((f) => (
              <MediaFileRow
                key={f.id}
                file={f}
                onDelete={() =>
                  window.confirm(`Delete ${f.filename}?`) &&
                  deleteFile.mutate(f.id)
                }
                isDeleting={deleteFile.isLoading}
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
