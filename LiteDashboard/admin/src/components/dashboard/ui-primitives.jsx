// Shared theme-aware visual primitives used throughout the admin panel.
// Binds layout aesthetics directly with active CSS variables custom properties.

export function Pill({ children, className = "", tone = "neutral" }) {
  const tones = {
    neutral: {
      backgroundColor: "var(--color-surface-2)",
      borderColor: "var(--color-border)",
      color: "var(--color-text-secondary)"
    },
    green: {
      backgroundColor: "var(--color-success-bg)",
      borderColor: "var(--color-border)",
      color: "var(--color-success)"
    },
    blue: {
      backgroundColor: "var(--color-accent-bg)",
      borderColor: "var(--color-border)",
      color: "var(--color-accent)"
    },
    amber: {
      backgroundColor: "var(--color-warn-bg)",
      borderColor: "var(--color-border)",
      color: "var(--color-warn)"
    },
    red: {
      backgroundColor: "var(--color-danger-bg)",
      borderColor: "var(--color-border)",
      color: "var(--color-danger)"
    },
  };

  const style = tones[tone] || tones.neutral;

  return (
    <span
      style={style}
      className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ status = "active" }) {
  const colors = {
    active: "bg-green-500",
    inactive: "bg-gray-400",
    warn: "bg-amber-500",
    error: "bg-red-500",
  };
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full ${colors[status] || colors.inactive}`}
    />
  );
}

export function Card({ children, className = "" }) {
  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
      className={`border rounded-xl ${className}`}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        disabled
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : "bg-[#2563EB] text-white hover:bg-blue-700"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className = "",
  danger = false,
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        danger
          ? "bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-600"
          : "bg-[#EFF6FF] text-[#2563EB] hover:bg-blue-100 focus-visible:ring-blue-600"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 style={{ color: "var(--color-text-primary)" }} className="text-lg font-semibold">{title}</h2>
        {subtitle && <p style={{ color: "var(--color-text-secondary)" }} className="text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
      className="border border-dashed rounded-xl py-16 px-6 text-center"
    >
      {icon && (
        <div className="flex justify-center mb-3" style={{ color: "var(--color-text-secondary)" }}>{icon}</div>
      )}
      <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold mb-1">{title}</p>
      {description && (
        <p style={{ color: "var(--color-text-secondary)" }} className="text-xs max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FieldLabel({ children, hint }) {
  return (
    <div>
      <label style={{ color: "var(--color-text-secondary)" }} className="block text-xs font-medium mb-1.5">
        {children}
      </label>
      {hint && <p style={{ color: "var(--color-text-muted)" }} className="text-xs -mt-1 mb-1.5">{hint}</p>}
    </div>
  );
}

export function Spinner({ size = 14 }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin"
      style={{ width: size, height: size }}
    />
  );
}

export function InspectorSection({ title, description, children, className = "" }) {
  return (
    <section
      className={`rounded-lg border overflow-hidden ${className}`}
      style={{
        backgroundColor: "var(--color-surface-2)",
        borderColor: "var(--color-border)",
      }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {title}
        </div>
        {description ? (
          <p
            className="mt-1 text-[10px] leading-4"
            style={{ color: "var(--color-text-muted)" }}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
