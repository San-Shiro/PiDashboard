// System control: WiFi, Bluetooth, display, power.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Pill,
  StatusDot,
  SectionHeader,
  Spinner,
} from "../ui-primitives";
import {
  Wifi,
  Bluetooth,
  Power,
  Monitor,
  Sun,
  Moon,
  RotateCcw,
} from "lucide-react";

function signalBars(strength) {
  if (strength > 70) return 4;
  if (strength > 50) return 3;
  if (strength > 30) return 2;
  return 1;
}

function WifiSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["system-wifi"],
    queryFn: async () => {
      const r = await fetch("/api/system/wifi");
      if (!r.ok) throw new Error("wifi");
      return r.json();
    },
    refetchInterval: 15000,
  });

  if (isLoading)
    return (
      <Card className="py-8 flex justify-center">
        <Spinner />
      </Card>
    );
  if (!data) return null;

  return (
    <Card>
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-[#F9FAFB] rounded-t-xl">
        <div className="flex items-center gap-2">
          <Wifi size={14} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-900">WiFi</span>
        </div>
        {data.current && (
          <Pill tone="blue">
            <StatusDot status="active" />
            Connected to {data.current.ssid}
          </Pill>
        )}
      </div>
      {data.current && (
        <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {data.current.ssid}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">
                {data.current.ip}
              </p>
            </div>
            <div className="flex items-end gap-0.5">
              {[1, 2, 3, 4].map((b) => (
                <span
                  key={b}
                  className={`w-1 rounded-sm ${b <= signalBars(data.current.signal) ? "bg-blue-600" : "bg-gray-200"}`}
                  style={{ height: 4 + b * 3 }}
                />
              ))}
              <span className="ml-1.5 text-xs text-gray-500 font-mono">
                {data.current.signal}%
              </span>
            </div>
          </div>
        </div>
      )}
      {data.networks
        .filter((n) => !n.connected)
        .map((n, i, arr) => (
          <div
            key={n.ssid}
            className={`px-5 py-3 flex items-center justify-between ${i < arr.length - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50 transition-colors`}
          >
            <div className="min-w-0">
              <p className="text-sm text-gray-900">{n.ssid}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {n.secured ? "Secured" : "Open"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-0.5">
                {[1, 2, 3, 4].map((b) => (
                  <span
                    key={b}
                    className={`w-1 rounded-sm ${b <= signalBars(n.signal) ? "bg-gray-400" : "bg-gray-200"}`}
                    style={{ height: 4 + b * 3 }}
                  />
                ))}
              </div>
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Connect
              </button>
            </div>
          </div>
        ))}
    </Card>
  );
}

function BluetoothSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["system-bluetooth"],
    queryFn: async () => {
      const r = await fetch("/api/system/bluetooth");
      if (!r.ok) throw new Error("bt");
      return r.json();
    },
  });

  if (isLoading)
    return (
      <Card className="py-8 flex justify-center">
        <Spinner />
      </Card>
    );
  if (!data) return null;

  return (
    <Card>
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-[#F9FAFB] rounded-t-xl">
        <div className="flex items-center gap-2">
          <Bluetooth size={14} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-900">Bluetooth</span>
        </div>
        <Pill>
          <StatusDot status={data.enabled ? "active" : "inactive"} />
          {data.enabled ? "Enabled" : "Disabled"}
        </Pill>
      </div>
      {data.devices.map((d, i, arr) => (
        <div
          key={d.mac}
          className={`px-5 py-3 flex items-center justify-between ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}
        >
          <div className="min-w-0">
            <p className="text-sm text-gray-900">{d.name}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{d.mac}</p>
          </div>
          <div className="flex items-center gap-2">
            {d.connected && (
              <Pill tone="blue">
                <StatusDot status="active" />
                Connected
              </Pill>
            )}
            {!d.connected && d.paired && <Pill>Paired</Pill>}
            {!d.paired && (
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Pair
              </button>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}

function DisplayPowerSection() {
  const queryClient = useQueryClient();
  const { data: state } = useQuery({
    queryKey: ["system-state"],
    queryFn: async () => {
      const r = await fetch("/api/system/state");
      if (!r.ok) throw new Error("state");
      return r.json();
    },
  });

  const toggle = useMutation({
    mutationFn: async (changes) => {
      const r = await fetch("/api/system/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!r.ok) throw new Error("toggle");
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["system-state"] }),
  });

  const displayOn = state?.display_enabled ?? true;
  const toggleLabel = displayOn ? "Turn screen off" : "Turn screen on";

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Monitor size={14} className="text-gray-500" />
        <span className="text-sm font-medium text-gray-900">
          Display & power
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => toggle.mutate({ display_enabled: !displayOn })}
          className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
            displayOn
              ? "bg-[#EFF6FF] text-[#2563EB] hover:bg-blue-100"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {displayOn ? <Moon size={14} /> : <Sun size={14} />}
          {toggleLabel}
        </button>
        <button
          onClick={() =>
            window.confirm("Reboot the Pi now?") &&
            alert("Reboot command sent (mock)")
          }
          className="flex items-center justify-center gap-2 bg-amber-50 text-amber-700 rounded-lg px-4 py-3 text-sm font-medium hover:bg-amber-100 transition-colors"
        >
          <RotateCcw size={14} />
          Reboot Pi
        </button>
        <button
          onClick={() =>
            window.confirm(
              "Shutdown the Pi? You'll need physical access to turn it back on.",
            ) && alert("Shutdown command sent (mock)")
          }
          className="flex items-center justify-center gap-2 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm font-medium hover:bg-red-100 transition-colors"
        >
          <Power size={14} />
          Shutdown
        </button>
      </div>
    </Card>
  );
}

export default function SystemControlTab() {
  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          title="Display & power"
          subtitle="Direct hardware control over the Pi"
        />
        <DisplayPowerSection />
      </div>
      <div>
        <SectionHeader title="Network" subtitle="Available WiFi networks" />
        <WifiSection />
      </div>
      <div>
        <SectionHeader title="Bluetooth" subtitle="Paired and nearby devices" />
        <BluetoothSection />
      </div>
    </div>
  );
}
