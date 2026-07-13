import { useState } from "react";
import Icon from "../icon";
import {
  Pill,
  StatusDot,
  Card,
  GhostButton,
  SectionHeader,
  EmptyState,
} from "../ui-primitives";
import { getWidgetVisuals } from "../widget-meta";
import {
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Layers,
  Clock,
} from "lucide-react";

function WidgetInstanceCard({ instance, onToggle, onEdit }) {
  const manifest = instance.manifest || {};
  const visuals = getWidgetVisuals(manifest);
  const base = instance.base_config || {};
  const sched =
    base.activeFrom === "00:00" && base.activeTo === "23:59"
      ? "Always on"
      : `${base.activeFrom} – ${base.activeTo}`;

  return (
    <Card className="p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: visuals.bg }}
          >
            <Icon
              name={manifest.icon}
              size={18}
              style={{ color: visuals.color }}
            />
          </div>
          <div className="min-w-0">
            <h3 style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold truncate">
              {instance.label}
            </h3>
            <p style={{ color: "var(--color-text-secondary)" }} className="text-xs mt-0.5">
              {manifest.name || instance.widget_id}
            </p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          title={instance.enabled ? "Disable widget" : "Enable widget"}
        >
          {instance.enabled ? (
            <ToggleRight size={24} style={{ color: "#2563EB" }} />
          ) : (
            <ToggleLeft size={24} />
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Pill>
          <StatusDot status={instance.enabled ? "active" : "inactive"} />
          {instance.enabled ? "Enabled" : "Disabled"}
        </Pill>
        <Pill>
          <Layers size={10} />
          Layer {base.zIndex}
        </Pill>
        <Pill>{Math.round((base.opacity ?? 1) * 100)}% opacity</Pill>
        <Pill>
          <Clock size={10} />
          {sched}
        </Pill>
      </div>

      <div style={{ borderColor: "var(--color-border)" }} className="border-t pt-4 flex items-center justify-between">
        <div style={{ color: "var(--color-text-secondary)" }} className="font-mono text-xs">
          <span style={{ color: "var(--color-text-muted)" }}>x:</span>
          {base.x} <span style={{ color: "var(--color-text-muted)" }}>y:</span>
          {base.y}
          <span style={{ color: "var(--color-border)" }} className="mx-2">|</span>
          {base.width}×{base.height}
        </div>
        <GhostButton onClick={onEdit}>
          <Edit2 size={11} />
          Edit
        </GhostButton>
      </div>
    </Card>
  );
}

function AddWidgetMenu({ registry, onAdd, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="absolute inset-0 bg-black/40"
        style={{ pointerEvents: "auto" }}
        onClick={onClose}
      />
      <div
        className="relative border rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        style={{
          pointerEvents: "auto",
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)"
        }}
      >
        <div
          className="sticky top-0 px-5 py-4 z-10"
          style={{
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)"
          }}
        >
          <h3 style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold">Add a widget</h3>
          <p style={{ color: "var(--color-text-secondary)" }} className="text-xs mt-0.5">
            Pick a widget type to add a new instance to your layout
          </p>
        </div>
        <div className="p-3">
          {registry.map((w) => {
            const m = w;
            const visuals = getWidgetVisuals(m);
            return (
              <button
                key={w.id}
                onClick={() => {
                  onAdd(w.id);
                  onClose();
                }}
                className="w-full text-left p-3 rounded-lg hover-surface-2 transition-colors flex items-start gap-3"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: visuals.bg }}
                >
                  <Icon
                    name={m.icon}
                    size={18}
                    style={{ color: visuals.color }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold">
                      {m.name}
                    </span>
                    <span style={{ color: "var(--color-text-muted)" }} className="text-xs font-mono">
                      v{m.version}
                    </span>
                  </div>
                  <p style={{ color: "var(--color-text-secondary)" }} className="text-xs mt-0.5">
                    {m.description}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    <Pill>{m.category}</Pill>
                    <Pill>{m.estimatedRamMb || 0} MB</Pill>
                    <Pill>{m.tier === 2 ? "Daemon" : "Native"}</Pill>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function WidgetsTab({
  instances,
  registry,
  onToggle,
  onEdit,
  onAddInstance,
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <SectionHeader
        title="Widgets"
        subtitle="Configure widget instances that appear on the kiosk display."
        action={
          <button
            onClick={() => setShowAdd(true)}
            style={{ backgroundColor: "var(--color-accent)", color: "#FFFFFF" }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Add widget
          </button>
        }
      />

      {instances.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} />}
          title="No widgets yet"
          description="Add your first widget to start building the dashboard."
          action={
            <button
              onClick={() => setShowAdd(true)}
              style={{ backgroundColor: "var(--color-accent)", color: "#FFFFFF" }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={14} />
              Add widget
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {instances.map((inst) => (
            <WidgetInstanceCard
              key={inst.id}
              instance={inst}
              onToggle={() => onToggle(inst.id)}
              onEdit={() => onEdit(inst)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddWidgetMenu
          registry={registry}
          onAdd={onAddInstance}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
