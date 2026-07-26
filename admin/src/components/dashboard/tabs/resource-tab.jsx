import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, SectionHeader, StatusDot, Spinner } from "../ui-primitives";
import { Activity, Server, RefreshCw, Terminal } from "lucide-react";

export default function ResourceTab() {
  const queryClient = useQueryClient();

  const { data: servicesData, isLoading: isServicesLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const r = await fetch("/api/system/services");
      if (!r.ok) throw new Error("services");
      return r.json();
    },
    refetchInterval: 3000,
  });

  const { data: logsData, isLoading: isLogsLoading } = useQuery({
    queryKey: ["system-logs"],
    queryFn: async () => {
      const r = await fetch("/api/system/logs");
      if (!r.ok) throw new Error("logs");
      return r.json();
    },
    refetchInterval: 2000,
  });

  const restartService = useMutation({
    mutationFn: async (id) => {
      await fetch("/api/system/services/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <SectionHeader
        icon={Server}
        title="Resource & Daemon Management"
        description="Monitor system services, widget daemons, and view live application logs."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col h-[500px]">
          <div
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderBottom: "1px solid var(--color-border)",
            }}
            className="px-5 py-3 flex items-center justify-between rounded-t-xl shrink-0"
          >
            <div className="flex items-center gap-2">
              <Activity size={14} style={{ color: "var(--color-text-secondary)" }} />
              <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
                Active Daemons & Services
              </span>
            </div>
            {isServicesLoading && <Spinner />}
          </div>
          <div className="overflow-y-auto p-0 flex-1">
            {servicesData?.services?.map((svc, i, arr) => (
              <div
                key={svc.id || svc.name}
                style={{
                  borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
                }}
                className="px-5 py-4 flex flex-col hover-surface-2 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <StatusDot status={svc.healthy ? "active" : "error"} />
                    <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
                      {svc.name}
                    </span>
                    {svc.core && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold">
                        Core
                      </span>
                    )}
                  </div>
                  {!svc.core && (
                    <button
                      onClick={() => restartService.mutate(svc.id || svc.name)}
                      className="p-1.5 rounded hover:bg-white/5 transition-colors"
                      title="Restart Daemon"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>
                  <span>State: <span style={{ color: svc.state === "running" ? "var(--color-success)" : "var(--color-warning)" }}>{svc.state}</span></span>
                  <span>Uptime: {svc.uptimeSec}s</span>
                  {svc.pid && <span>PID: {svc.pid}</span>}
                  {svc.restartCount > 0 && <span style={{ color: "var(--color-error)" }}>Restarts: {svc.restartCount}</span>}
                </div>
                {svc.lastError && (
                  <div className="mt-2 text-xs p-2 rounded bg-red-500/10 text-red-400 font-mono break-all">
                    {svc.lastError}
                  </div>
                )}
                {svc.missingDependencies && svc.missingDependencies.length > 0 && (
                  <div className="mt-2 text-xs p-2 rounded bg-yellow-500/10 text-yellow-400 font-mono">
                    Missing deps: {svc.missingDependencies.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col h-[500px] overflow-hidden">
          <div
            style={{
              backgroundColor: "var(--color-surface-2)",
              borderBottom: "1px solid var(--color-border)",
            }}
            className="px-5 py-3 flex items-center justify-between rounded-t-xl shrink-0"
          >
            <div className="flex items-center gap-2">
              <Terminal size={14} style={{ color: "var(--color-text-secondary)" }} />
              <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
                Live System Logs
              </span>
            </div>
            {isLogsLoading && <Spinner />}
          </div>
          <div 
            className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed"
            style={{ backgroundColor: "#000", color: "#ddd" }}
          >
            {logsData?.logs?.length === 0 && (
              <div className="text-center text-gray-500 py-8">No logs available</div>
            )}
            {logsData?.logs?.map((log, i) => {
              const date = new Date(log.timestamp);
              const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
              let color = "#aaa";
              if (log.level === 'error') color = "#f87171";
              if (log.level === 'warn') color = "#fbbf24";
              if (log.level === 'info') color = "#60a5fa";
              
              return (
                <div key={i} className="flex gap-3 mb-1 hover:bg-white/5 rounded px-1 -mx-1 transition-colors">
                  <span className="text-gray-500 shrink-0">{time}</span>
                  <span style={{ color }} className="shrink-0 w-12 font-semibold">[{log.level.toUpperCase()}]</span>
                  <span className="text-gray-400 shrink-0 w-24 truncate">({log.source})</span>
                  <span className="break-all whitespace-pre-wrap flex-1">{log.message}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
