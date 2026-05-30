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

function WidgetRegistryCard({ widget }) {
  const visuals = getWidgetVisuals(widget);

  return (
    <Card className="p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: visuals.bg }}
          >
            <Icon
              name={widget.icon}
              size={18}
              style={{ color: visuals.color }}
            />
          </div>
          <div className="min-w-0">
            <h3 style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold truncate">
              {widget.name}
            </h3>
            <p style={{ color: "var(--color-text-secondary)" }} className="text-xs mt-0.5 font-mono">
              v{widget.version}
            </p>
          </div>
        </div>
      </div>

      <p style={{ color: "var(--color-text-secondary)" }} className="text-xs mb-4">
        {widget.description}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Pill>{widget.category || 'General'}</Pill>
        <Pill>{widget.estimatedRamMb ? `${widget.estimatedRamMb} MB` : '< 1 MB'}</Pill>
        <Pill>{widget.daemon ? "Daemon" : "Native"}</Pill>
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
                    <Pill>{m.category || 'General'}</Pill>
                    <Pill>{m.estimatedRamMb ? `${m.estimatedRamMb} MB` : '< 1 MB'}</Pill>
                    <Pill>{m.daemon ? "Daemon" : "Native"}</Pill>
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

export default function WidgetsTab({ registry }) {
  return (
    <div>
      <SectionHeader
        title="Widget Registry"
        subtitle="Available widgets installed on the system that can be added to canvases."
      />

      {registry.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} />}
          title="No widgets found"
          description="Install widgets into the widgets directory."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {registry.map((widget) => (
            <WidgetRegistryCard
              key={widget.id}
              widget={widget}
            />
          ))}
        </div>
      )}
    </div>
  );
}
