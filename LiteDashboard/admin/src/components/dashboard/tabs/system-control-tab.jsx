// System control: Display, WiFi, Bluetooth, Security.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Pill,
  StatusDot,
  SectionHeader,
  PrimaryButton,
  Spinner,
  FieldLabel,
} from "../ui-primitives";
import {
  Wifi,
  Bluetooth,
  Power,
  Monitor,
  Sun,
  Moon,
  RotateCcw,
  Shield,
  Check,
  AlertTriangle,
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
      <div
        style={{
          backgroundColor: "var(--color-surface-2)",
          borderBottom: "1px solid var(--color-border)"
        }}
        className="px-5 py-3 flex items-center justify-between rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <Wifi size={14} style={{ color: "var(--color-text-secondary)" }} />
          <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">WiFi</span>
        </div>
        {data.current && (
          <Pill tone="blue">
            <StatusDot status="active" />
            Connected to {data.current.ssid}
          </Pill>
        )}
      </div>
      {data.current && (
        <div
          style={{
            backgroundColor: "var(--color-accent-bg)",
            borderBottom: "1px solid var(--color-border)"
          }}
          className="px-5 py-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
                {data.current.ssid}
              </p>
              <p style={{ color: "var(--color-text-secondary)" }} className="text-xs mt-0.5 font-mono">
                {data.current.ip}
              </p>
            </div>
            <div className="flex items-end gap-0.5">
              {[1, 2, 3, 4].map((b) => (
                <span
                  key={b}
                  style={{
                    height: 4 + b * 3,
                    backgroundColor: b <= signalBars(data.current.signal) ? "var(--color-accent)" : "var(--color-border)"
                  }}
                  className="w-1 rounded-sm"
                />
              ))}
              <span style={{ color: "var(--color-text-secondary)" }} className="ml-1.5 text-xs font-mono">
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
            style={{
              borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : "none"
            }}
            className="px-5 py-3 flex items-center justify-between hover-surface-2 transition-colors"
          >
            <div className="min-w-0">
              <p style={{ color: "var(--color-text-primary)" }} className="text-sm">{n.ssid}</p>
              <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-0.5">
                {n.secured ? "Secured" : "Open"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-0.5">
                {[1, 2, 3, 4].map((b) => (
                  <span
                    key={b}
                    style={{
                      height: 4 + b * 3,
                      backgroundColor: b <= signalBars(n.signal) ? "var(--color-text-secondary)" : "var(--color-border)"
                    }}
                    className="w-1 rounded-sm"
                  />
                ))}
              </div>
              <button
                style={{ color: "var(--color-accent)" }}
                className="text-xs hover:opacity-80 font-medium"
              >
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
      <div
        style={{
          backgroundColor: "var(--color-surface-2)",
          borderBottom: "1px solid var(--color-border)"
        }}
        className="px-5 py-3 flex items-center justify-between rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <Bluetooth size={14} style={{ color: "var(--color-text-secondary)" }} />
          <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">Bluetooth</span>
        </div>
        <Pill>
          <StatusDot status={data.enabled ? "active" : "inactive"} />
          {data.enabled ? "Enabled" : "Disabled"}
        </Pill>
      </div>
      {data.devices.map((d, i, arr) => (
        <div
          key={d.mac}
          style={{
            borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : "none"
          }}
          className="px-5 py-3 flex items-center justify-between hover-surface-2 transition-colors"
        >
          <div className="min-w-0">
            <p style={{ color: "var(--color-text-primary)" }} className="text-sm">{d.name}</p>
            <p style={{ color: "var(--color-text-muted)" }} className="text-xs font-mono mt-0.5">{d.mac}</p>
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
              <button
                style={{ color: "var(--color-accent)" }}
                className="text-xs hover:opacity-80 font-medium"
              >
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
        <Monitor size={14} style={{ color: "var(--color-text-secondary)" }} />
        <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
          Display & power
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => toggle.mutate({ display_enabled: !displayOn })}
          style={{
            backgroundColor: displayOn ? "var(--color-accent-bg)" : "var(--color-surface-2)",
            color: displayOn ? "var(--color-accent)" : "var(--color-text-primary)"
          }}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {displayOn ? <Moon size={14} /> : <Sun size={14} />}
          {toggleLabel}
        </button>
        <button
          onClick={() =>
            window.confirm("Reboot the Pi now?") &&
            alert("Reboot command sent (mock)")
          }
          style={{
            backgroundColor: "var(--color-warn-bg)",
            color: "var(--color-warn)"
          }}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
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
          style={{
            backgroundColor: "var(--color-danger-bg)",
            color: "var(--color-danger)"
          }}
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Power size={14} />
          Shutdown
        </button>
      </div>
    </Card>
  );
}

function SecuritySection() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const changePw = useMutation({
    mutationFn: async ({ currentPassword, newPassword }) => {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || data.message || "Failed");
      return data;
    },
    onSuccess: () => {
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setErrorMsg("");
      setSuccessMsg("Password updated successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (e) => {
      setSuccessMsg("");
      setErrorMsg(e.message || "Failed to change password");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (newPw !== confirmPw) {
      setErrorMsg("New passwords don't match");
      return;
    }
    if (newPw.length < 4) {
      setErrorMsg("Password must be at least 4 characters");
      return;
    }
    changePw.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm";
  const inputStyle = {
    borderColor: "var(--color-border)",
    color: "var(--color-text-primary)",
    backgroundColor: "var(--color-surface)",
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={14} style={{ color: "var(--color-text-secondary)" }} />
        <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium">
          Change admin password
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <FieldLabel>Current password</FieldLabel>
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            className={inputCls}
            style={inputStyle}
            required
          />
        </div>
        <div>
          <FieldLabel>New password</FieldLabel>
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className={inputCls}
            style={inputStyle}
            placeholder="Min. 4 characters"
            required
          />
        </div>
        <div>
          <FieldLabel>Confirm new password</FieldLabel>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            className={inputCls}
            style={inputStyle}
            required
          />
        </div>

        {successMsg && (
          <div
            className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg"
            style={{ backgroundColor: "var(--color-accent-bg)", color: "var(--color-accent)" }}
          >
            <Check size={13} />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div
            className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg"
            style={{ backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            <AlertTriangle size={13} />
            {errorMsg}
          </div>
        )}

        <PrimaryButton type="submit" disabled={changePw.isPending}>
          {changePw.isPending ? <Spinner size={12} /> : <Shield size={12} />}
          Update password
        </PrimaryButton>
      </form>
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
      <div>
        <SectionHeader title="Security" subtitle="Change admin password" />
        <SecuritySection />
      </div>
    </div>
  );
}
