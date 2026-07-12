// GPIO testing & configuration page
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Pill,
  StatusDot,
  SectionHeader,
  GhostButton,
  PrimaryButton,
  Spinner,
  FieldLabel,
} from "../ui-primitives";
import {
  Cpu,
  Zap,
  Plus,
  Trash2,
  Save,
  Check,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

// Pi header physical pin layout (2x20) mapping physical pin → BCM GPIO
// null = power/ground, number = BCM GPIO
const PI_HEADER = [
  // [left, right] per row — physical pins 1-40
  [null, null],     // 1=3.3V, 2=5V
  [2, null],        // 3=GPIO2/SDA, 4=5V
  [3, null],        // 5=GPIO3/SCL, 6=GND
  [4, 14],          // 7=GPIO4, 8=GPIO14/TX
  [null, 15],       // 9=GND, 10=GPIO15/RX
  [17, 18],         // 11=GPIO17, 12=GPIO18
  [27, null],       // 13=GPIO27, 14=GND
  [22, 23],         // 15=GPIO22, 16=GPIO23
  [null, 24],       // 17=3.3V, 18=GPIO24
  [10, null],       // 19=GPIO10/MOSI, 20=GND
  [9, 25],          // 21=GPIO9/MISO, 22=GPIO25
  [11, 8],          // 23=GPIO11/SCLK, 24=GPIO8/CE0
  [null, 7],        // 25=GND, 26=GPIO7/CE1
  [0, 1],           // 27=ID_SD, 28=ID_SC
  [5, null],        // 29=GPIO5, 30=GND
  [6, 12],          // 31=GPIO6, 32=GPIO12
  [13, null],       // 33=GPIO13, 34=GND
  [19, 16],         // 35=GPIO19, 36=GPIO16
  [26, 20],         // 37=GPIO26, 38=GPIO20
  [null, 21],       // 39=GND, 40=GPIO21
];

const ACTION_LABELS = {
  toggle_maintenance: "Toggle Maintenance",
  toggle_display: "Toggle Display",
  next_canvas: "Next Canvas",
  prev_canvas: "Previous Canvas",
  reload_display: "Reload Display",
};

const TRIGGER_OPTIONS = ["falling", "rising", "both"];

function PinCell({ bcm, state, selected, onClick }) {
  if (bcm === null) {
    // Power/Ground pin
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[8px] font-mono opacity-30"
        style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
      >
        •
      </div>
    );
  }

  const isOut = state?.mode === "out";
  const isHigh = state?.value === 1;

  let bg = "var(--color-surface-2)";
  let border = "var(--color-border)";
  let color = "var(--color-text-muted)";

  if (isOut && isHigh) {
    bg = "var(--color-accent-bg)";
    border = "var(--color-accent)";
    color = "var(--color-accent)";
  } else if (isOut && !isHigh) {
    bg = "rgba(239,68,68,0.08)";
    border = "rgba(239,68,68,0.3)";
    color = "#ef4444";
  } else if (!isOut) {
    bg = "rgba(59,130,246,0.06)";
    border = "rgba(59,130,246,0.2)";
    color = "#3b82f6";
  }

  return (
    <button
      onClick={() => onClick(bcm)}
      className="w-9 h-9 rounded-lg flex flex-col items-center justify-center text-[9px] font-mono font-bold border transition-all hover:scale-110 active:scale-95"
      style={{
        backgroundColor: bg,
        borderColor: selected ? "var(--color-accent)" : border,
        color,
        boxShadow: selected ? "0 0 0 2px var(--color-accent)" : isHigh && isOut ? "0 0 8px rgba(99,102,241,0.3)" : "none",
      }}
      title={`GPIO ${bcm} — ${isOut ? "OUT" : "IN"} — ${isHigh ? "HIGH" : "LOW"}`}
    >
      {bcm}
    </button>
  );
}

function PinHeader({ pins, selectedPin, onSelect }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Cpu size={14} style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          GPIO Header
        </span>
        <Pill>BCM numbering</Pill>
        {!pins && <Spinner size={12} />}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-[10px]">
        {[
          { color: "var(--color-accent)", label: "Output HIGH" },
          { color: "#ef4444", label: "Output LOW" },
          { color: "#3b82f6", label: "Input" },
          { color: "var(--color-text-muted)", label: "Power/GND" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
            <span style={{ color: "var(--color-text-secondary)" }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Pin grid */}
      <div className="flex justify-center">
        <div className="space-y-1">
          {PI_HEADER.map(([left, right], row) => (
            <div key={row} className="flex items-center gap-1">
              <PinCell
                bcm={left}
                state={left !== null ? pins?.[left] : null}
                selected={selectedPin === left}
                onClick={onSelect}
              />
              <div className="w-3 flex justify-center">
                <span className="text-[7px] font-mono opacity-20" style={{ color: "var(--color-text-muted)" }}>
                  {row * 2 + 1}
                </span>
              </div>
              <PinCell
                bcm={right}
                state={right !== null ? pins?.[right] : null}
                selected={selectedPin === right}
                onClick={onSelect}
              />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function PinControlPanel({ pin, state, onClose }) {
  const queryClient = useQueryClient();

  const setMode = useMutation({
    mutationFn: async (mode) => {
      const r = await fetch(`/api/gpio/pins/${pin}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!r.ok) throw new Error("mode");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gpio-pins"] }),
  });

  const writeVal = useMutation({
    mutationFn: async (value) => {
      const r = await fetch(`/api/gpio/pins/${pin}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!r.ok) throw new Error("write");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gpio-pins"] }),
  });

  const isOut = state?.mode === "out";
  const isHigh = state?.value === 1;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: "var(--color-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            GPIO {pin} Control
          </span>
        </div>
        <GhostButton onClick={onClose}>Close</GhostButton>
      </div>

      {/* Status */}
      <div
        className="rounded-xl p-4 mb-4 flex items-center justify-between border"
        style={{ backgroundColor: "var(--color-surface-2)", borderColor: "var(--color-border)" }}
      >
        <div>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Current state</p>
          <p className="text-lg font-bold font-mono mt-1" style={{ color: "var(--color-text-primary)" }}>
            {isOut ? "OUTPUT" : "INPUT"} — {isHigh ? "HIGH" : "LOW"}
          </p>
        </div>
        <div
          className="w-6 h-6 rounded-full transition-all"
          style={{
            backgroundColor: isHigh ? "#22c55e" : "var(--color-surface)",
            boxShadow: isHigh ? "0 0 12px rgba(34,197,94,0.5)" : "inset 0 1px 3px rgba(0,0,0,0.3)",
            border: isHigh ? "none" : "1px solid var(--color-border)",
          }}
        />
      </div>

      {/* Mode toggle */}
      <div className="mb-4">
        <FieldLabel>Pin direction</FieldLabel>
        <div className="flex gap-2">
          <button
            onClick={() => setMode.mutate("in")}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold border transition-all"
            style={{
              backgroundColor: !isOut ? "var(--color-accent-bg)" : "transparent",
              borderColor: !isOut ? "var(--color-accent)" : "var(--color-border)",
              color: !isOut ? "var(--color-accent)" : "var(--color-text-secondary)",
            }}
          >
            <ArrowDown size={13} />
            Input
          </button>
          <button
            onClick={() => setMode.mutate("out")}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold border transition-all"
            style={{
              backgroundColor: isOut ? "var(--color-accent-bg)" : "transparent",
              borderColor: isOut ? "var(--color-accent)" : "var(--color-border)",
              color: isOut ? "var(--color-accent)" : "var(--color-text-secondary)",
            }}
          >
            <ArrowUp size={13} />
            Output
          </button>
        </div>
      </div>

      {/* Value control (output only) */}
      {isOut && (
        <div>
          <FieldLabel>Output value</FieldLabel>
          <button
            onClick={() => writeVal.mutate(isHigh ? 0 : 1)}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all"
            style={{
              backgroundColor: isHigh ? "var(--color-accent-bg)" : "var(--color-surface-2)",
              color: isHigh ? "var(--color-accent)" : "var(--color-text-secondary)",
              border: `1px solid ${isHigh ? "var(--color-accent)" : "var(--color-border)"}`,
            }}
          >
            {isHigh ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {isHigh ? "HIGH (1) — Click to set LOW" : "LOW (0) — Click to set HIGH"}
          </button>
        </div>
      )}

      {!isOut && (
        <div
          className="rounded-lg px-4 py-3 text-xs text-center"
          style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
        >
          Reading input value in real-time (polls every 2s)
        </div>
      )}
    </Card>
  );
}

function BindingsSection() {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState("");

  const { data } = useQuery({
    queryKey: ["gpio-bindings"],
    queryFn: async () => {
      const r = await fetch("/api/gpio/bindings");
      if (!r.ok) throw new Error("bindings");
      return r.json();
    },
  });

  const [localBindings, setLocalBindings] = useState(null);
  const bindings = localBindings ?? data?.bindings ?? [];

  const saveBindings = useMutation({
    mutationFn: async (bindings) => {
      const r = await fetch("/api/gpio/bindings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bindings }),
      });
      if (!r.ok) throw new Error("save");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gpio-bindings"] });
      setLocalBindings(null);
      setSuccessMsg("Bindings saved!");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  const addBinding = () => {
    setLocalBindings([...bindings, { pin: 17, trigger: "falling", action: "toggle_maintenance" }]);
  };

  const removeBinding = (idx) => {
    const next = bindings.filter((_, i) => i !== idx);
    setLocalBindings(next);
  };

  const updateBinding = (idx, field, value) => {
    const next = bindings.map((b, i) =>
      i === idx ? { ...b, [field]: field === "pin" ? parseInt(value) : value } : b
    );
    setLocalBindings(next);
  };

  const selectStyle = {
    borderColor: "var(--color-border)",
    color: "var(--color-text-primary)",
    backgroundColor: "var(--color-surface)",
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: "var(--color-accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            GPIO → Action Bindings
          </span>
        </div>
        <GhostButton onClick={addBinding}>
          <Plus size={12} />
          Add binding
        </GhostButton>
      </div>

      <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
        Bind physical GPIO pins to admin actions. When a pin trigger fires, the action executes automatically.
      </p>

      {bindings.length === 0 ? (
        <div
          className="rounded-lg py-8 text-center text-xs"
          style={{ backgroundColor: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
        >
          No bindings configured. Click "Add binding" to get started.
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {bindings.map((b, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center"
            >
              <select
                value={b.pin}
                onChange={(e) => updateBinding(i, "pin", e.target.value)}
                className="border rounded-lg px-2 py-2 text-xs font-mono"
                style={selectStyle}
              >
                {[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27].map((p) => (
                  <option key={p} value={p}>GPIO {p}</option>
                ))}
              </select>
              <select
                value={b.trigger}
                onChange={(e) => updateBinding(i, "trigger", e.target.value)}
                className="border rounded-lg px-2 py-2 text-xs"
                style={selectStyle}
              >
                {TRIGGER_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={b.action}
                onChange={(e) => updateBinding(i, "action", e.target.value)}
                className="border rounded-lg px-2 py-2 text-xs"
                style={selectStyle}
              >
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button
                onClick={() => removeBinding(i)}
                className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                style={{ color: "var(--color-danger)" }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {successMsg && (
        <div
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg mb-3"
          style={{ backgroundColor: "var(--color-accent-bg)", color: "var(--color-accent)" }}
        >
          <Check size={13} />
          {successMsg}
        </div>
      )}

      {bindings.length > 0 && (
        <PrimaryButton onClick={() => saveBindings.mutate(bindings)} disabled={saveBindings.isPending}>
          {saveBindings.isPending ? <Spinner size={12} /> : <Save size={12} />}
          Save bindings
        </PrimaryButton>
      )}
    </Card>
  );
}

export default function GpioTab() {
  const [selectedPin, setSelectedPin] = useState(null);

  const { data } = useQuery({
    queryKey: ["gpio-pins"],
    queryFn: async () => {
      const r = await fetch("/api/gpio/pins");
      if (!r.ok) throw new Error("gpio");
      return r.json();
    },
    refetchInterval: 2000,
  });

  const pins = data?.pins || {};
  const isPi = data?.is_pi ?? false;

  const handleSelectPin = useCallback((bcm) => {
    setSelectedPin((prev) => (prev === bcm ? null : bcm));
  }, []);

  return (
    <div className="space-y-8">
      {/* Dev mode banner */}
      {!isPi && (
        <div
          className="border rounded-xl px-4 py-3 flex items-center gap-3"
          style={{
            backgroundColor: "var(--color-warn-bg)",
            borderColor: "var(--color-warn)",
            color: "var(--color-warn)",
          }}
        >
          <AlertTriangle size={16} className="shrink-0" />
          <div>
            <p className="text-sm font-medium">Development mode</p>
            <p className="text-xs mt-0.5 opacity-80">
              Not running on Raspberry Pi — using mock GPIO state. Pin changes are simulated in memory.
            </p>
          </div>
        </div>
      )}

      {/* Pin Header + Control */}
      <div>
        <SectionHeader
          title="GPIO Pin Header"
          subtitle="Click any GPIO pin to configure. BCM numbering."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PinHeader pins={pins} selectedPin={selectedPin} onSelect={handleSelectPin} />
          {selectedPin !== null ? (
            <PinControlPanel
              pin={selectedPin}
              state={pins[selectedPin]}
              onClose={() => setSelectedPin(null)}
            />
          ) : (
            <Card className="p-5 flex flex-col items-center justify-center text-center min-h-[200px]">
              <Cpu
                size={32}
                style={{ color: "var(--color-text-muted)" }}
                className="mb-3 opacity-30"
              />
              <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Select a pin
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Click any GPIO pin on the header to view and control it
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Action Bindings */}
      <div>
        <SectionHeader
          title="Pin → Action Bindings"
          subtitle="Bind physical buttons to admin panel actions"
        />
        <BindingsSection />
      </div>
    </div>
  );
}
