// Themes tab — view and activate built-in themes, create custom themes.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../theme-provider";
import {
  Card,
  Pill,
  SectionHeader,
  EmptyState,
  GhostButton,
  PrimaryButton,
  Spinner,
  FieldLabel,
} from "../ui-primitives";
import { Check, Trash2, Plus, Sun, Moon } from "lucide-react";

const TOKEN_LABELS = {
  "--color-bg": "Page background",
  "--color-surface": "Card / panel",
  "--color-surface-2": "Subtle surface",
  "--color-border": "Border",
  "--color-text-primary": "Primary text",
  "--color-text-secondary": "Secondary text",
  "--color-accent": "Accent / links",
  "--color-accent-bg": "Accent background",
  "--color-danger": "Danger",
  "--color-warn": "Warning",
  "--color-success": "Success",
  "--color-header-bg": "Header background",
};

function ColourSwatch({ config }) {
  const swatches = [
    config["--color-bg"],
    config["--color-surface"],
    config["--color-accent"],
    config["--color-text-primary"],
    config["--color-success"],
    config["--color-danger"],
  ].filter(Boolean);

  return (
    <div className="flex gap-1 mt-3">
      {swatches.map((c, i) => (
        <div
          key={i}
          className="w-6 h-6 rounded-md border border-black/10"
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
    </div>
  );
}

function ThemeCard({ theme, onActivate, onDelete, isActivating }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {theme.name}
          </h3>
          <div className="flex gap-1.5 mt-1.5">
            {theme.is_active && (
              <Pill tone="blue">
                <Check size={10} />
                Active
              </Pill>
            )}
            {theme.is_builtin && <Pill>Built-in</Pill>}
            {!theme.is_builtin && <Pill>Custom</Pill>}
          </div>
        </div>
        {!theme.is_builtin && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            title="Delete theme"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <ColourSwatch config={theme.config || {}} />

      <div
        className="mt-4 pt-3 border-t"
        style={{ borderColor: "var(--color-border)" }}
      >
        <GhostButton
          onClick={onActivate}
          className={theme.is_active ? "opacity-50 cursor-not-allowed" : ""}
        >
          {isActivating ? <Spinner size={11} /> : <Check size={11} />}
          {theme.is_active ? "Currently active" : "Activate"}
        </GhostButton>
      </div>
    </Card>
  );
}

function CustomThemeBuilder({ onSave, onClose }) {
  const [name, setName] = useState("My Theme");
  const [config, setConfig] = useState({
    "--color-bg": "#F9FAFB",
    "--color-surface": "#FFFFFF",
    "--color-surface-2": "#F3F4F6",
    "--color-border": "#E5E7EB",
    "--color-text-primary": "#111827",
    "--color-text-secondary": "#6B7280",
    "--color-accent": "#2563EB",
    "--color-accent-bg": "#EFF6FF",
    "--color-danger": "#DC2626",
    "--color-warn": "#D97706",
    "--color-success": "#16A34A",
    "--color-header-bg": "#FFFFFF",
  });

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
        className="relative rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border"
        style={{
          pointerEvents: "auto",
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <div
          className="sticky top-0 px-5 py-4 border-b z-10"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Create custom theme
          </h3>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <FieldLabel>Theme name</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
                backgroundColor: "var(--color-surface)",
              }}
            />
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: "var(--color-text-muted)" }}
            >
              Colour tokens
            </p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(TOKEN_LABELS).map(([key, label]) => (
                <div key={key}>
                  <FieldLabel>{label}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config[key] || "#000000"}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, [key]: e.target.value }))
                      }
                      className="w-8 h-8 rounded border cursor-pointer p-0.5"
                      style={{ borderColor: "var(--color-border)" }}
                    />
                    <input
                      type="text"
                      value={config[key] || ""}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, [key]: e.target.value }))
                      }
                      className="flex-1 border rounded-lg px-2 py-1.5 text-xs font-mono"
                      style={{
                        borderColor: "var(--color-border)",
                        color: "var(--color-text-primary)",
                        backgroundColor: "var(--color-surface)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          className="sticky bottom-0 px-5 py-4 border-t flex justify-end gap-2"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton
            onClick={() => {
              onSave({ name, config });
              onClose();
            }}
          >
            Save theme
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default function ThemesTab() {
  const queryClient = useQueryClient();
  const { activeTheme, themes, activateTheme, isDark, toggleDarkLight } =
    useTheme();
  const [showBuilder, setShowBuilder] = useState(false);
  const [activatingId, setActivatingId] = useState(null);

  const createTheme = useMutation({
    mutationFn: async ({ name, config }) => {
      const r = await fetch("/api/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config }),
      });
      if (!r.ok) throw new Error("create");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["themes"] }),
  });

  const deleteTheme = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/themes/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["themes"] }),
  });

  const handleActivate = (id) => {
    setActivatingId(id);
    activateTheme(id);
    setTimeout(() => setActivatingId(null), 1500);
  };

  const builtIn = themes.filter((t) => t.is_builtin);
  const custom = themes.filter((t) => !t.is_builtin);

  return (
    <div className="space-y-8">
      {/* Quick toggle */}
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            Quick switch
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Currently: <strong>{activeTheme?.name || "Unknown"}</strong>
          </p>
        </div>
        <button
          onClick={toggleDarkLight}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: isDark ? "#fbbf24" : "#1f2937",
            color: isDark ? "#1f2937" : "#f9fafb",
          }}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          {isDark ? "Switch to Light" : "Switch to Dark"}
        </button>
      </Card>

      {/* Built-in themes */}
      <div>
        <SectionHeader
          title="Built-in themes"
          subtitle="Cannot be deleted — always available"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {builtIn.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              onActivate={() => handleActivate(t.id)}
              isActivating={activatingId === t.id}
            />
          ))}
        </div>
      </div>

      {/* Custom themes */}
      <div>
        <SectionHeader
          title="Custom themes"
          subtitle="Create your own colour scheme"
          action={
            <PrimaryButton onClick={() => setShowBuilder(true)}>
              <Plus size={12} />
              New theme
            </PrimaryButton>
          }
        />
        {custom.length === 0 ? (
          <EmptyState
            title="No custom themes yet"
            description="Create a custom colour scheme tailored to your display and room lighting."
            action={
              <GhostButton onClick={() => setShowBuilder(true)}>
                <Plus size={11} />
                Create custom theme
              </GhostButton>
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {custom.map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                onActivate={() => handleActivate(t.id)}
                onDelete={() =>
                  window.confirm(`Delete theme "${t.name}"?`) &&
                  deleteTheme.mutate(t.id)
                }
                isActivating={activatingId === t.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Token reference */}
      <div>
        <SectionHeader
          title="CSS custom property tokens"
          subtitle="These variables are applied to :root and used by all admin panel components"
        />
        <Card>
          {Object.entries(TOKEN_LABELS).map(([key, label], i, arr) => (
            <div
              key={key}
              className={`flex items-center justify-between px-5 py-2.5 ${i < arr.length - 1 ? "border-b" : ""}`}
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded border border-black/10"
                  style={{ backgroundColor: `var(${key})` }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {label}
                </span>
              </div>
              <code
                className="text-xs font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                {key}
              </code>
            </div>
          ))}
        </Card>
      </div>

      {showBuilder && (
        <CustomThemeBuilder
          onSave={({ name, config }) => createTheme.mutate({ name, config })}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </div>
  );
}
