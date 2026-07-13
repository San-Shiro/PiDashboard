// System overview: live RAM/CPU graphs, service status, maintenance mode toggle,
// quick service restart, and per-widget RAM breakdown.
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Icon from "../icon";
import {
  Pill,
  StatusDot,
  Card,
  SectionHeader,
  GhostButton,
  Spinner,
} from "../ui-primitives";
import {
  Activity,
  Cpu,
  MemoryStick,
  Thermometer,
  HardDrive,
  Power,
  RotateCcw,
  AlertTriangle,
  Server,
} from "lucide-react";

function MiniChart({ data, color = "#2563EB", height = 50 }) {
  if (!data || data.length === 0) {
    return <div style={{ height }} className="bg-gray-50 rounded" />;
  }
  const max = Math.max(...data, 1);
  const w = 100;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * w;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `0,${height} ${points} ${w},${height}`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
    >
      <polygon points={area} fill={`${color}15`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function StatCard({ icon, label, value, hint, history, color }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {icon}
          {label}
        </div>
        {hint && (
          <span className="text-xs text-gray-400 font-mono">{hint}</span>
        )}
      </div>
      <div className="text-2xl font-semibold text-gray-900 tracking-tight tabular-nums">
        {value}
      </div>
      {history && (
        <div className="mt-2">
          <MiniChart data={history} color={color} />
        </div>
      )}
    </Card>
  );
}

export default function OverviewTab() {
  const queryClient = useQueryClient();
  const [cpuHistory, setCpuHistory] = useState([]);
  const [ramHistory, setRamHistory] = useState([]);

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

  const { data: services } = useQuery({
    queryKey: ["system-services"],
    queryFn: async () => {
      const r = await fetch("/api/system/services");
      if (!r.ok) throw new Error("services");
      return r.json();
    },
    refetchInterval: 5000,
  });

  const { data: sysState } = useQuery({
    queryKey: ["system-state"],
    queryFn: async () => {
      const r = await fetch("/api/system/state");
      if (!r.ok) throw new Error("state");
      return r.json();
    },
  });

  useEffect(() => {
    if (stats) {
      setCpuHistory((h) => [...h, stats.cpu_percent].slice(-30));
      setRamHistory((h) => [...h, stats.mem_percent].slice(-30));
    }
  }, [stats]);

  const toggleMaintenance = useMutation({
    mutationFn: async (on) => {
      const r = await fetch("/api/system/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenance_mode: on }),
      });
      if (!r.ok) throw new Error("toggle");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-state"] });
      queryClient.invalidateQueries({ queryKey: ["system-stats"] });
      queryClient.invalidateQueries({ queryKey: ["system-services"] });
    },
  });

  const restartService = useMutation({
    mutationFn: async (name) => {
      const r = await fetch("/api/system/services/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error("restart");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-services"] });
    },
  });

  const uptimeHrs = stats ? Math.floor(stats.uptime_seconds / 3600) : 0;
  const uptimeMin = stats ? Math.floor((stats.uptime_seconds % 3600) / 60) : 0;
  const maintenance = sysState?.maintenance_mode || false;

  return (
    <div className="space-y-8">
      {/* Maintenance mode banner */}
      {maintenance && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                Maintenance mode is active
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Kiosk display and widget daemons are paused. Admin panel has
                full compute.
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleMaintenance.mutate(false)}
            className="inline-flex items-center gap-1.5 bg-amber-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-amber-700 transition-colors"
            disabled={toggleMaintenance.isLoading}
          >
            {toggleMaintenance.isLoading && <Spinner size={11} />}
            Resume display
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div>
        <SectionHeader
          title="System health"
          subtitle="Live metrics from the Pi · refreshing every 3s"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Cpu size={12} />}
            label="CPU usage"
            value={stats ? `${stats.cpu_percent}%` : "—"}
            history={cpuHistory}
            color="#2563EB"
          />
          <StatCard
            icon={<MemoryStick size={12} />}
            label="RAM"
            value={stats ? `${stats.mem_used_mb}MB` : "—"}
            hint={
              stats ? `${stats.mem_percent}% of ${stats.mem_total_mb}MB` : ""
            }
            history={ramHistory}
            color="#EA580C"
          />
          <StatCard
            icon={<Thermometer size={12} />}
            label="CPU temp"
            value={stats ? `${stats.cpu_temp}°C` : "—"}
            hint={stats && stats.cpu_temp > 70 ? "warm" : "normal"}
          />
          <StatCard
            icon={<Activity size={12} />}
            label="Uptime"
            value={`${uptimeHrs}h ${uptimeMin}m`}
            hint={stats?.load_avg ? `load ${stats.load_avg[0].toFixed(2)}` : ""}
          />
        </div>
      </div>

      {/* Process breakdown */}
      {stats?.processes && (
        <div>
          <SectionHeader
            title="Process memory"
            subtitle="Per-process RAM and CPU usage including widget daemons"
            action={
              <button
                onClick={() => toggleMaintenance.mutate(!maintenance)}
                disabled={toggleMaintenance.isLoading}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  maintenance
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-amber-500 text-white hover:bg-amber-600"
                }`}
              >
                {toggleMaintenance.isLoading && <Spinner size={12} />}
                <Power size={12} />
                {maintenance ? "Exit maintenance" : "Enter maintenance mode"}
              </button>
            }
          />
          <Card>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-[#F9FAFB] rounded-t-xl">
              <span>Process</span>
              <div className="flex gap-6">
                <span>RAM</span>
                <span>CPU</span>
              </div>
            </div>
            {[
              stats.processes.bun && {
                name: "Bun HTTP server",
                ...stats.processes.bun,
              },
              stats.processes.cog && {
                name: "cog (WPE WebKit kiosk)",
                ...stats.processes.cog,
              },
              ...(stats.processes.widget_daemons || []),
            ]
              .filter(Boolean)
              .map((p, i, arr) => (
                <div
                  key={p.name}
                  className={`px-5 py-3 flex items-center justify-between ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}
                >
                  <span className="text-sm text-gray-900 font-mono">
                    {p.name}
                  </span>
                  <div className="flex gap-6 text-sm tabular-nums">
                    <span className="text-gray-700">{p.ram_mb}MB</span>
                    <span className="text-gray-500 w-12 text-right">
                      {p.cpu.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
          </Card>
        </div>
      )}

      {/* Service status */}
      <div>
        <SectionHeader
          title="Services"
          subtitle="systemd-managed processes — restart from here if a widget hangs"
        />
        <Card>
          {(services?.services || []).map((svc, i, arr) => (
            <div
              key={svc.name}
              className={`px-5 py-3 flex items-center justify-between ${i < arr.length - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50 transition-colors`}
            >
              <div className="min-w-0">
                <p className="text-sm font-mono text-gray-900">{svc.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {svc.core && (
                    <span className="text-blue-600 font-medium mr-2">CORE</span>
                  )}
                  {svc.desc}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Pill>
                  <StatusDot
                    status={svc.status === "running" ? "active" : "inactive"}
                  />
                  {svc.status}
                </Pill>
                <button
                  onClick={() => restartService.mutate(svc.name)}
                  disabled={restartService.isLoading}
                  className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
                  title="Restart service"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
