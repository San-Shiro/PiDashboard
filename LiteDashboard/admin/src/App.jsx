import { useState, useCallback, useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Monitor,
  Eye,
  AlertTriangle,
  LogOut,
  Sun,
  Moon,
  Activity,
  Cpu,
  Image,
  Palette,
  Settings,
  ShoppingBag,
  Info,
  Menu,
  X,
  Server
} from "lucide-react";
import ThemeProvider, { useTheme } from "@/components/dashboard/theme-provider";
import AuthGate from "@/components/dashboard/auth-gate";
import OverviewTab from "@/components/dashboard/tabs/overview-tab";
import WidgetsTab from "@/components/dashboard/tabs/widgets-tab";
import MediaTab from "@/components/dashboard/tabs/media-tab";
import CanvasesTab from "@/components/dashboard/tabs/canvases-tab";
import ThemesTab from "@/components/dashboard/tabs/themes-tab";
import AboutTab from "@/components/dashboard/tabs/about-tab";
import SystemControlTab from "@/components/dashboard/tabs/system-control-tab";
import ResourceTab from "@/components/dashboard/tabs/resource-tab";
import MarketplaceTab from "@/components/dashboard/tabs/marketplace-tab";
import GpioTab from "@/components/dashboard/tabs/gpio-tab";
import CanvasEditorPage from "@/components/dashboard/canvas-editor-page";
import WidgetEditPanel from "@/components/dashboard/widget-edit-panel";
import { Pill, StatusDot, Spinner } from "@/components/dashboard/ui-primitives";

const DASHBOARD_TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "widgets", label: "Widgets", icon: Cpu },
  { id: "canvases", label: "Canvases", icon: LayoutTemplate },
  { id: "media", label: "Media", icon: Image },
];

const SETTINGS_TABS = [
  { id: "themes", label: "Themes", icon: Palette },
  { id: "system", label: "System", icon: Settings },
  { id: "resources", label: "Resources", icon: Server },
  { id: "gpio", label: "GPIO", icon: Cpu },
  { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { id: "about", label: "About", icon: Info },
];

function AdminShell() {
  const queryClient = useQueryClient();
  const { isDark, toggleDarkLight, activeTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingInstanceId, setEditingInstanceId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // System Stats Query for Sidebar live metrics
  const { data: stats } = useQuery({
    queryKey: ["system-stats"],
    queryFn: async () => {
      const r = await fetch("/api/system/stats");
      if (!r.ok) throw new Error("stats");
      return r.json();
    },
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });

  const { data: registryData } = useQuery({
    queryKey: ["widget-registry"],
    queryFn: async () => {
      const r = await fetch("/api/widgets/registry");
      if (!r.ok) throw new Error("registry");
      return r.json();
    },
  });

  const { data: canvasesData, isLoading: canvasesLoading } = useQuery({
    queryKey: ["canvases"],
    queryFn: async () => {
      const r = await fetch("/api/canvases");
      if (!r.ok) throw new Error("canvases");
      return r.json();
    },
  });

  const { data: mediaData } = useQuery({
    queryKey: ["media-files"],
    queryFn: async () => {
      const r = await fetch("/api/media");
      if (!r.ok) throw new Error("media");
      return r.json();
    },
  });

  const { data: sysState } = useQuery({
    queryKey: ["system-state"],
    queryFn: async () => {
      const r = await fetch("/api/system/state");
      if (!r.ok) throw new Error("state");
      return r.json();
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["auth-status"] }),
  });

  const registry = registryData?.widgets || [];
  const mediaFiles = mediaData?.files || [];
  const maintenance = sysState?.maintenance_mode;
  const canvases = canvasesData?.canvases || [];

  const activeTabLabel = useMemo(() => {
    const tab = [...DASHBOARD_TABS, ...SETTINGS_TABS].find((t) => t.id === activeTab);
    return tab ? tab.label : "Overview";
  }, [activeTab]);

  if (canvasesLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-inter"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <Spinner size={20} />
      </div>
    );
  }

  // Live sidebar CPU & RAM values
  const cpuPercent = stats ? Math.round(stats.cpu_percent) : 0;
  const memPercent = stats ? Math.round(stats.mem_percent) : 0;
  const memUsedMb = stats ? Math.round(stats.mem_used_mb) : 0;
  const memTotalMb = stats ? Math.round(stats.mem_total_mb) : 512;

  const renderSidebarContent = () => (
    <>
      {/* Brand Header */}
      <div 
        className="px-6 py-5 flex items-center gap-3 border-b shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-md"
          style={{ backgroundColor: "var(--color-accent)", color: "#FFFFFF" }}
        >
          <Monitor size={16} />
        </div>
        <div className="min-w-0">
          <h1
            className="text-sm font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Pi Dashboard
          </h1>
          <p className="text-[10px] font-medium tracking-wide uppercase opacity-60" style={{ color: "var(--color-text-muted)" }}>
            Control panel
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Dashboard Section */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider opacity-40">
            Dashboard
          </p>
          <div className="space-y-1">
            {DASHBOARD_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 group ${
                    active
                      ? "shadow-sm"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: active ? "var(--color-accent-bg)" : "transparent",
                    color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
                  }}
                >
                  <Icon size={14} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Section */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider opacity-40">
            Settings
          </p>
          <div className="space-y-1">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-200 group ${
                    active
                      ? "shadow-sm"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: active ? "var(--color-accent-bg)" : "transparent",
                    color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
                  }}
                >
                  <Icon size={14} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* System Health Compact Card & Footer */}
      <div 
        className="p-4 border-t shrink-0 bg-black/5"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
      >
        <div className="bg-black/15 rounded-xl p-3 space-y-2.5 border" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between text-[10px] font-semibold">
            <span className="flex items-center gap-1.5" style={{ color: "var(--color-text-primary)" }}>
              <Server size={10} style={{ color: "var(--color-accent)" }} />
              System
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="opacity-60 font-mono">active</span>
            </span>
          </div>

          {/* CPU Metric */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono opacity-80">
              <span>@ CPU</span>
              <span>{cpuPercent}%</span>
            </div>
            <div className="w-full h-1 bg-black/20 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${cpuPercent}%`, 
                  backgroundColor: cpuPercent > 80 ? "var(--color-danger)" : cpuPercent > 60 ? "var(--color-warn)" : "var(--color-accent)" 
                }}
              />
            </div>
          </div>

          {/* RAM Metric */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono opacity-80">
              <span>~ RAM</span>
              <span>{memPercent}%</span>
            </div>
            <div className="w-full h-1 bg-black/20 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${memPercent}%`, 
                  backgroundColor: memPercent > 85 ? "var(--color-danger)" : "var(--color-accent)" 
                }}
              />
            </div>
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-[10px] font-mono opacity-65" style={{ color: "var(--color-text-secondary)" }}>
            {canvases.length} canvases
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleDarkLight}
              className="p-1 rounded-lg hover:bg-black/10 transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
              title={isDark ? "Switch to light" : "Switch to midnight"}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <button
              onClick={() => logout.mutate()}
              className="p-1 rounded-lg hover:bg-black/10 transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="min-h-screen flex font-inter select-none overflow-x-hidden animate-fade-in"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s ease-out forwards;
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 99px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: var(--color-border-2);
        }
      `}</style>

      {/* 1. Large Screen Sidebar */}
      <aside
        className="hidden md:flex flex-col w-60 border-r shrink-0 min-h-screen sticky top-0 shadow-sm"
        style={{
          backgroundColor: "var(--color-header-bg)",
          borderColor: "var(--color-header-border)",
        }}
      >
        {renderSidebarContent()}
      </aside>

      {/* 2. Mobile Responsive Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer Panel */}
          <aside
            className="relative flex flex-col w-60 h-full border-r z-10 animate-slide-in shadow-2xl"
            style={{
              backgroundColor: "var(--color-header-bg)",
              borderColor: "var(--color-header-border)",
            }}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-black/10 transition-colors z-20"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <X size={15} />
            </button>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* 3. Main Content Container */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Header Navbar */}
        <header
          className="px-6 py-4 flex items-center justify-between sticky top-0 z-40 border-b shadow-sm"
          style={{
            backgroundColor: "var(--color-header-bg)",
            borderColor: "var(--color-header-border)",
          }}
        >
          {/* Left Side: Mobile Menu Trigger + Breadcrumbs */}
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded-lg md:hidden mr-2 transition-colors hover:bg-black/10 active:scale-95"
              style={{ color: "var(--color-text-primary)" }}
            >
              <Menu size={16} />
            </button>
            
            <div className="flex items-center gap-2 text-xs font-semibold opacity-70" style={{ color: "var(--color-text-secondary)" }}>
              <Monitor size={13} style={{ color: "var(--color-accent)" }} className="shrink-0" />
              <span className="hidden sm:inline">Pi Dashboard</span>
              <span className="opacity-40 font-normal">&gt;</span>
              <span style={{ color: "var(--color-text-primary)" }}>{activeTabLabel}</span>
            </div>

            {maintenance && (
              <Pill tone="amber" className="ml-3 py-0.5 px-2 text-[10px]">
                <AlertTriangle size={9} />
                Maintenance
              </Pill>
            )}
          </div>

          {/* Right Side: Quick Display Link + Widgets live indicators */}
          <div className="flex items-center gap-3 shrink-0">
            <Pill tone="green" className="py-0.5 px-2.5 text-[10px] font-semibold hidden sm:inline-flex shadow-sm">
              <StatusDot status="active" />
              {canvases.length} canvases available
            </Pill>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-md transition-all hover:scale-[1.03] active:scale-[0.98] duration-200"
              style={{
                backgroundColor: "var(--color-accent)",
                color: "#FFFFFF",
              }}
            >
              <Eye size={12} />
              Open display
            </a>
          </div>
        </header>

        {/* Dynamic Tab Body content */}
        <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 animate-fade-in">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "widgets" && (
            <WidgetsTab
              registry={registry}
            />
          )}
          {activeTab === "canvases" && (
            <CanvasesTab onAfterApply={() => setEditingInstanceId(null)} />
          )}
          {activeTab === "media" && <MediaTab />}
          {activeTab === "themes" && <ThemesTab />}
          {activeTab === "system" && <SystemControlTab />}
          {activeTab === "resources" && <ResourceTab />}
          {activeTab === "marketplace" && <MarketplaceTab />}
          {activeTab === "gpio" && <GpioTab />}
          {activeTab === "about" && <AboutTab />}
        </main>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ThemeProvider>
      <AuthGate>
        <Routes>
          <Route path="/canvas/:canvasId/edit" element={<CanvasEditorPage />} />
          <Route path="/*" element={<AdminShell />} />
        </Routes>
      </AuthGate>
    </ThemeProvider>
  );
}
