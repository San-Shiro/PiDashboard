import React, { useMemo, useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Icon from "../icon";
import {
  Pill,
  Card,
  SectionHeader,
  EmptyState,
  Spinner,
} from "../ui-primitives";
import { getWidgetVisuals } from "../widget-meta";
import {
  Layers,
  Trash2,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Info
} from "lucide-react";


function WidgetRegistryCard({ widget, onUninstall, isUninstalling }) {
  const [showDetails, setShowDetails] = useState(false);
  const visuals = getWidgetVisuals(widget);
  const isCommunity = widget.id.startsWith("community-");

  return (
    <Card className="p-3 hover:border-gray-300 transition-colors flex flex-col relative group">
      {/* Row Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 shadow-sm"
          style={{ backgroundColor: visuals.bg }}
        >
          <Icon
            name={widget.icon}
            size={16}
            style={{ color: visuals.color }}
          />
        </div>
        
        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 style={{ color: "var(--color-text-primary)" }} className="text-[13px] font-semibold truncate">
            {widget.name}
          </h3>
          <span style={{ color: "var(--color-text-secondary)" }} className="text-[10px] font-mono shrink-0">
            v{widget.version}
          </span>
          {isCommunity ? (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 shrink-0">
              Community
            </span>
          ) : (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
              Core
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1.5 rounded-lg transition-all hover:bg-black/5"
            style={{ 
              color: showDetails ? "var(--color-accent)" : "var(--color-text-secondary)",
              backgroundColor: showDetails ? "var(--color-accent-bg)" : "transparent" 
            }}
            title="More Info"
          >
            <Info size={14} />
          </button>
          
          {isCommunity ? (
            <button
              onClick={() => {
                if (window.confirm(`Uninstall ${widget.name}?`)) {
                  onUninstall(widget.id);
                }
              }}
              disabled={isUninstalling}
              className="p-1.5 rounded-lg opacity-0 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-red-50"
              style={{ color: "var(--color-danger, #ef4444)" }}
              title="Uninstall Widget"
            >
              {isUninstalling ? <Spinner size={14} /> : <Trash2 size={14} />}
            </button>
          ) : (
            <div className="w-[26px]"></div> /* Placeholder for alignment */
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ borderColor: "var(--color-border)" }}>
          <p style={{ color: "var(--color-text-secondary)" }} className="text-[11px] flex-1 leading-relaxed">
            {widget.description}
          </p>

          <div className="flex flex-wrap items-start gap-1.5 shrink-0">
            <Pill className="text-[9px] py-0.5 px-1.5">{widget.category || 'General'}</Pill>
            <Pill className="text-[9px] py-0.5 px-1.5">{widget.estimatedRamMb ? `~${widget.estimatedRamMb} MB` : '< 1 MB'}</Pill>
            <Pill className="text-[9px] py-0.5 px-1.5">{widget.daemon ? "Daemon" : "Native"}</Pill>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function WidgetsTab({ registry }) {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("all"); // "all", "core", "community"

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const fileInputRef = useRef(null);

  const deleteWidget = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/widgets/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to uninstall");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widget-registry"] });
    },
    onError: (err) => {
      alert(`Uninstall failed: ${err.message}`);
    }
  });

  const handleInstallClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setStatus({ type: "", message: "" });
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/widgets/install", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setStatus({ type: "success", message: "Widget installed successfully!" });
        queryClient.invalidateQueries({ queryKey: ["widget-registry"] });
        setFilterType("community"); // Switch to community view to see it
      } else {
        const error = await res.json();
        setStatus({ type: "error", message: "Installation failed: " + (error.error || error.message || "Unknown error") });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Installation failed: " + err.message });
    } finally {
      setUploading(false);
      e.target.value = null; // reset
      setTimeout(() => setStatus({ type: "", message: "" }), 5000); // clear status after 5s
    }
  };

  const visibleRegistry = useMemo(
    () =>
      registry.filter((widget) => {
        if (filterType === "core") return !widget.id.startsWith("community-");
        if (filterType === "community") return widget.id.startsWith("community-");
        return true;
      }),
    [registry, filterType],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Widgets & App Store"
        subtitle="Manage installed widgets, or upload new community widgets (.wig) to expand your dashboard."
      />

      {/* Manual Installation Banner */}
      <Card className="p-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-dashed border-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-50 text-blue-500 shrink-0">
            <UploadCloud size={16} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>Upload Community Widget</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
              Upload a `.wig` package to instantly install it and its daemons.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          {status.message && (
            <div className={`text-[11px] px-3 py-1.5 rounded-md flex items-center gap-1.5 ${status.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {status.type === 'success' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
              {status.message}
            </div>
          )}
          <button
            onClick={handleInstallClick}
            disabled={uploading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
          >
            {uploading ? <Spinner size={14} /> : <UploadCloud size={14} />}
            {uploading ? "Installing..." : "Install .wig"}
          </button>
          <input 
            type="file" 
            accept=".wig,.zip" 
            ref={fileInputRef} 
            style={{ display: "none" }} 
            onChange={handleFileChange} 
          />
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-1.5 rounded-xl bg-black/5" style={{ backgroundColor: "var(--color-surface-2)" }}>
        <div className="flex items-center gap-2 pl-2">
          <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Installed Widgets
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/10 font-mono" style={{ color: "var(--color-text-secondary)" }}>
            {visibleRegistry.length}
          </span>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Filter Type Toggle */}
          <div className="inline-flex rounded-lg overflow-hidden border bg-white flex-1 sm:flex-none" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
            {[
              { id: "all", label: "All" },
              { id: "core", label: "Core" },
              { id: "community", label: "Community" }
            ].map((ft) => (
              <button
                key={ft.id}
                onClick={() => setFilterType(ft.id)}
                className="px-2.5 py-1 text-[11px] font-medium transition-colors flex-1 sm:flex-none"
                style={{
                  backgroundColor: filterType === ft.id ? "var(--color-accent-bg)" : "transparent",
                  color: filterType === ft.id ? "var(--color-accent)" : "var(--color-text-secondary)",
                  borderRight: ft.id !== "community" ? "1px solid var(--color-border)" : "none",
                }}
              >
                {ft.label}
              </button>
            ))}
          </div>


        </div>
      </div>

      {visibleRegistry.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} />}
          title="No widgets found"
          description={
            filterType !== "all" 
              ? `No ${filterType} widgets found.`
              : "No widgets installed."
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {visibleRegistry.map((widget) => (
            <WidgetRegistryCard
              key={widget.id}
              widget={widget}
              onUninstall={(id) => deleteWidget.mutate(id)}
              isUninstalling={deleteWidget.isLoading && deleteWidget.variables === widget.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
