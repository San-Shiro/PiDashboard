import React, { useState, useRef } from "react";
import { Card, SectionHeader } from "../ui-primitives";
import { ShoppingBag, Download, UploadCloud, CheckCircle, AlertTriangle } from "lucide-react";

export default function MarketplaceTab() {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const fileInputRef = useRef(null);

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
        setStatus({ type: "success", message: "Widget installed successfully! It is now available in the Widget Registry." });
      } else {
        const error = await res.json();
        setStatus({ type: "error", message: "Installation failed: " + (error.error || error.message || "Unknown error") });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Installation failed: " + err.message });
    } finally {
      setUploading(false);
      e.target.value = null; // reset
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Widget Marketplace & Installation"
        subtitle="Install community widgets or manually upload .wig packages to expand your dashboard."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local Installation Box */}
        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
            <UploadCloud size={100} />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>Manual Installation</h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                Upload a `.wig` or `.zip` widget package directly. The system will extract it, validate the manifest, and register any included background daemons automatically.
              </p>
            </div>
            
            <div className="mt-auto pt-4">
              {status.message && (
                <div className={`text-[11px] px-3 py-2 rounded-md mb-3 flex items-center gap-2 ${status.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {status.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  {status.message}
                </div>
              )}
              <button
                onClick={handleInstallClick}
                disabled={uploading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
              >
                <UploadCloud size={16} />
                {uploading ? "Installing..." : "Upload & Install .wig Package"}
              </button>
              <input 
                type="file" 
                accept=".wig,.zip" 
                ref={fileInputRef} 
                style={{ display: "none" }} 
                onChange={handleFileChange} 
              />
            </div>
          </div>
        </Card>

        {/* Community Catalog Teaser */}
        <Card className="p-6 relative overflow-hidden" style={{ backgroundColor: "var(--color-surface-2)" }}>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle at top right, var(--color-accent), transparent 60%)" }} />
          <div className="relative z-10 flex flex-col h-full items-center justify-center text-center py-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-sm" style={{ backgroundColor: "var(--color-surface)", color: "var(--color-accent)" }}>
              <ShoppingBag size={24} />
            </div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>Community Catalog</h3>
            <p className="text-xs mb-4 max-w-[250px]" style={{ color: "var(--color-text-secondary)" }}>
              A curated online directory of third-party widgets available for one-click installation.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold border" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Under Construction
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
      {/* Feature Preview */}
      <div>
        <SectionHeader
          title="Planned features"
          subtitle="What to expect from the marketplace"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={Download}
            title="One-Click Install"
            description="Install widgets with a single tap. Automatic dependency resolution and setup."
          />
          <FeatureCard
            icon={Settings}
            title="Auto-Configure Daemons"
            description="Daemon-powered widgets automatically register and start their systemd services."
          />
          <FeatureCard
            icon={Star}
            title="Community Reviews"
            description="Rate and review widgets. See RAM estimates and compatibility info before installing."
          />
        </div>
      </div>
    </div>
  );
}
