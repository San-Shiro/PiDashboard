import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor, Eye, AlertTriangle, LogOut, Sun, Moon } from "lucide-react";
import ThemeProvider, { useTheme } from "@/components/dashboard/theme-provider";
import AuthGate from "@/components/dashboard/auth-gate";
import OverviewTab from "@/components/dashboard/tabs/overview-tab";
import WidgetsTab from "@/components/dashboard/tabs/widgets-tab";
import LayoutTab from "@/components/dashboard/tabs/layout-tab";
import MediaTab from "@/components/dashboard/tabs/media-tab";
import TemplatesTab from "@/components/dashboard/tabs/templates-tab";
import ThemesTab from "@/components/dashboard/tabs/themes-tab";
import DocsTab from "@/components/dashboard/tabs/docs-tab";
import SystemControlTab from "@/components/dashboard/tabs/system-control-tab";
import MarketplaceTab from "@/components/dashboard/tabs/marketplace-tab";
import WidgetEditPanel from "@/components/dashboard/widget-edit-panel";
import { Pill, StatusDot, Spinner } from "@/components/dashboard/ui-primitives";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "widgets", label: "Widgets" },
  { id: "layout", label: "Layout" },
  { id: "canvases", label: "Canvases" },
  { id: "media", label: "Media" },
  { id: "system", label: "System" },
];

function AdminShell() {
  const queryClient = useQueryClient();
  const { isDark, toggleDarkLight, activeTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingInstanceId, setEditingInstanceId] = useState(null);

  const { data: registryData } = useQuery({
    queryKey: ["widget-registry"],
    queryFn: async () => {
      const r = await fetch("/api/widgets/registry");
      if (!r.ok) throw new Error("registry");
      return r.json();
    },
  });

  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ["widget-instances"],
    queryFn: async () => {
      const r = await fetch("/api/widgets/instances");
      if (!r.ok) throw new Error("instances");
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

  const updateInstance = useMutation({
    mutationFn: async ({ id, changes }) => {
      const r = await fetch(`/api/widgets/instances/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!r.ok) throw new Error("update");
      return r.json();
    },
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: ["widget-instances"] });
      const prev = queryClient.getQueryData(["widget-instances"]);
      queryClient.setQueryData(["widget-instances"], (old) => {
        if (!old) return old;
        return {
          ...old,
          instances: old.instances.map((i) =>
            i.id === id ? { ...i, ...changes } : i,
          ),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["widget-instances"], ctx.prev);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["widget-instances"] }),
  });

  const addInstance = useMutation({
    mutationFn: async (widget_id) => {
      const r = await fetch("/api/widgets/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widget_id }),
      });
      if (!r.ok) throw new Error("add");
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["widget-instances"] }),
  });

  const deleteInstance = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/widgets/instances/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("delete");
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["widget-instances"] }),
  });

  const logout = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["auth-status"] }),
  });

  const instances = instancesData?.instances || [];
  const registry = registryData?.widgets || [];
  const mediaFiles = mediaData?.files || [];
  const enabledCount = instances.filter((i) => i.enabled).length;
  const maintenance = sysState?.maintenance_mode;

  const editingInstance = useMemo(
    () => instances.find((i) => i.id === editingInstanceId) || null,
    [instances, editingInstanceId],
  );

  const handleUpdateInstance = useCallback(
    (changes) => {
      if (!editingInstanceId) return;
      updateInstance.mutate({ id: editingInstanceId, changes });
    },
    [editingInstanceId, updateInstance],
  );

  const handleDeleteInstance = useCallback(() => {
    if (!editingInstanceId) return;
    deleteInstance.mutate(editingInstanceId);
    setEditingInstanceId(null);
  }, [editingInstanceId, deleteInstance]);

  if (instancesLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-inter"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-inter"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between sticky top-0 z-40 border-b"
        style={{
          backgroundColor: "var(--color-header-bg)",
          borderColor: "var(--color-header-border)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--color-text-primary)" }}
          >
            <Monitor size={15} style={{ color: "var(--color-bg)" }} />
          </div>
          <div className="min-w-0">
            <h1
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Pi Dashboard
            </h1>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Admin Panel
            </p>
          </div>
          <Pill className="ml-1 hidden sm:inline-flex">
            <StatusDot status="active" />
            {enabledCount} of {instances.length} active
          </Pill>
          {maintenance && (
            <Pill tone="amber" className="hidden md:inline-flex">
              <AlertTriangle size={10} />
              Maintenance
            </Pill>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-xs hidden lg:block"
            style={{ color: "var(--color-text-muted)" }}
          >
            {activeTheme?.name}
          </span>
          <button
            onClick={toggleDarkLight}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-text-secondary)" }}
            title={isDark ? "Switch to light" : "Switch to dark"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <a
            href="/display"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--color-accent-bg)",
              color: "var(--color-accent)",
            }}
          >
            <Eye size={14} />
            Display
          </a>
          <button
            onClick={() => logout.mutate()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors"
            style={{ color: "var(--color-text-secondary)" }}
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <div
        className="px-6 overflow-x-auto border-b"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex gap-6 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="pb-3 -mb-[1px] text-sm border-b-2 transition-colors focus-visible:outline-none whitespace-nowrap"
              style={{
                color:
                  activeTab === tab.id
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                fontWeight: activeTab === tab.id ? 500 : 400,
                borderColor:
                  activeTab === tab.id ? "var(--color-accent)" : "transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "widgets" && (
          <WidgetsTab
            instances={instances}
            registry={registry}
            onToggle={(id) => {
              const inst = instances.find((i) => i.id === id);
              if (inst)
                updateInstance.mutate({
                  id,
                  changes: { enabled: !inst.enabled },
                });
            }}
            onEdit={(inst) => setEditingInstanceId(inst.id)}
            onAddInstance={(widget_id) => addInstance.mutate(widget_id)}
          />
        )}
        {activeTab === "layout" && (
          <LayoutTab
            instances={instances}
            registry={registry}
            onUpdateInstance={(id, changes) =>
              updateInstance.mutate({ id, changes })
            }
            onSelectInstance={(inst) => setEditingInstanceId(inst.id)}
          />
        )}
        {activeTab === "canvases" && (
          <TemplatesTab onAfterApply={() => setEditingInstanceId(null)} />
        )}
        {activeTab === "media" && <MediaTab />}
        {activeTab === "themes" && <ThemesTab />}
        {activeTab === "system" && <SystemControlTab />}
        {activeTab === "marketplace" && <MarketplaceTab />}
        {activeTab === "docs" && <DocsTab />}
      </main>

      {editingInstance && (
        <WidgetEditPanel
          instance={editingInstance}
          mediaFiles={mediaFiles}
          onUpdateInstance={handleUpdateInstance}
          onDeleteInstance={handleDeleteInstance}
          onClose={() => setEditingInstanceId(null)}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <ThemeProvider>
      <AuthGate>
        <AdminShell />
      </AuthGate>
    </ThemeProvider>
  );
}
