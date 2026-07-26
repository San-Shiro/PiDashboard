// About page — version info, system stats, server health
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Pill,
  SectionHeader,
  Spinner,
} from "../ui-primitives";
import {
  Info,
  Server,
  Cpu,
  HardDrive,
  ExternalLink,
  Clock,
  Monitor,
  Box,
  Zap,
  Github,
} from "lucide-react";

const VERSION = "1.0.0-beta";
const BUILD_INFO = "Bun Runtime • React 18 • Tailwind 3";

function formatUptime(seconds) {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div
      className="rounded-xl p-4 border flex items-center gap-4 transition-all hover:scale-[1.01]"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: accent ? "var(--color-accent)" : "var(--color-border)",
        boxShadow: accent ? "0 0 20px rgba(99,102,241,0.08)" : "none",
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{
          backgroundColor: accent ? "var(--color-accent-bg)" : "var(--color-surface-2)",
          color: accent ? "var(--color-accent)" : "var(--color-text-secondary)",
        }}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-bold opacity-50">{label}</p>
        <p
          className="text-sm font-semibold truncate mt-0.5"
          style={{ color: "var(--color-text-primary)" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export default function AboutTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["system-stats"],
    queryFn: async () => {
      const r = await fetch("/api/system/stats");
      if (!r.ok) throw new Error("stats");
      return r.json();
    },
    refetchInterval: 5000,
  });

  const { data: registryData } = useQuery({
    queryKey: ["widget-registry"],
    queryFn: async () => {
      const r = await fetch("/api/widgets/registry");
      if (!r.ok) throw new Error("registry");
      return r.json();
    },
  });

  const { data: canvasesData } = useQuery({
    queryKey: ["canvases"],
    queryFn: async () => {
      const r = await fetch("/api/canvases");
      if (!r.ok) throw new Error("canvases");
      return r.json();
    },
  });

  const widgetCount = registryData?.widgets?.length || 0;
  const canvasCount = canvasesData?.canvases?.length || 0;

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div
        className="rounded-2xl p-8 border relative overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        {/* Decorative gradient blob */}
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: "var(--color-accent)" }}
        />
        <div className="relative z-10 flex items-start gap-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
            style={{
              background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-hover, #818cf8))",
              color: "#FFFFFF",
            }}
          >
            <Monitor size={28} />
          </div>
          <div>
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              PiDashboard
            </h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Pill tone="blue">v{VERSION}</Pill>
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {BUILD_INFO}
              </span>
            </div>
            <p
              className="text-xs mt-3 leading-relaxed max-w-lg"
              style={{ color: "var(--color-text-secondary)" }}
            >
              A lightweight, highly customizable smart dashboard system optimized for the
              Raspberry Pi Zero 2W. Kiosk-style display with real-time widgets, fully
              responsive admin control panel, and zero-framework display client.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div>
        <SectionHeader title="Dashboard overview" subtitle="Current system state at a glance" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Box} label="Widgets" value={`${widgetCount} installed`} accent />
          <StatCard icon={Monitor} label="Canvases" value={`${canvasCount} saved`} />
          <StatCard
            icon={Cpu}
            label="Server RAM"
            value={stats ? `${stats.server_rss_mb || Math.round(stats.processes?.bun?.ram_mb || 0)} MB` : "—"}
          />
          <StatCard
            icon={Clock}
            label="Uptime"
            value={formatUptime(stats?.uptime_seconds)}
          />
        </div>
      </div>

      {/* System Info */}
      <div>
        <SectionHeader title="System information" subtitle="Server runtime and hardware details" />
        {isLoading ? (
          <Card className="py-12 flex justify-center">
            <Spinner size={20} />
          </Card>
        ) : (
          <Card className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {[
              { label: "CPU Usage", value: `${stats?.cpu_percent || 0}%`, icon: Cpu },
              { label: "Memory", value: `${stats?.mem_used_mb || 0} / ${stats?.mem_total_mb || 0} MB (${stats?.mem_percent || 0}%)`, icon: HardDrive },
              { label: "CPU Temperature", value: stats?.cpu_temp ? `${stats.cpu_temp.toFixed(1)}°C` : "N/A", icon: Zap },
              { label: "Server Process", value: `${stats?.server_rss_mb || stats?.processes?.bun?.ram_mb || 0} MB RSS`, icon: Server },
              { label: "Load Average", value: stats?.load_avg ? stats.load_avg.map((l) => l.toFixed(2)).join(" / ") : "N/A", icon: Info },
            ].map((row, i) => (
              <div
                key={i}
                className="px-5 py-3.5 flex items-center justify-between"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex items-center gap-3">
                  <row.icon size={14} style={{ color: "var(--color-text-muted)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    {row.label}
                  </span>
                </div>
                <span className="text-xs font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {row.value}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Links */}
      <div>
        <SectionHeader title="Resources" subtitle="Documentation and project links" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a
            href="https://github.com/San-Shiro/PiDashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="group"
          >
            <Card className="p-5 flex items-center gap-4 transition-all group-hover:scale-[1.01]">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text-secondary)" }}
              >
                <Github size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  GitHub Repository
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Source code, issues, and contributions
                </p>
              </div>
              <ExternalLink size={14} style={{ color: "var(--color-text-muted)" }} className="shrink-0" />
            </Card>
          </a>
          <a
            href="/docs/WIDGET_DEV_GUIDE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="group"
          >
            <Card className="p-5 flex items-center gap-4 transition-all group-hover:scale-[1.01]">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--color-accent-bg)", color: "var(--color-accent)" }}
              >
                <Info size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Widget Development Guide
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Build custom widgets for the kiosk display
                </p>
              </div>
              <ExternalLink size={14} style={{ color: "var(--color-text-muted)" }} className="shrink-0" />
            </Card>
          </a>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] py-4 opacity-40" style={{ color: "var(--color-text-muted)" }}>
        PiDashboard v{VERSION} • Built with ♥ for Raspberry Pi
      </p>
    </div>
  );
}
