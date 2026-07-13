// Shared visual primitives used throughout the admin panel.
// Keeps the design tokens consistent across every tab.

export function Pill({ children, className = "", tone = "neutral" }) {
  const tones = {
    neutral: "bg-white border-gray-200 text-gray-700",
    green: "bg-white border-gray-200 text-gray-700",
    blue: "bg-[#EFF6FF] border-blue-100 text-[#2563EB]",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    red: "bg-red-50 border-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs ${tones[tone] || tones.neutral} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ status = "active" }) {
  const colors = {
    active: "bg-green-500",
    inactive: "bg-gray-300",
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
    <div className={`bg-white border border-gray-200 rounded-xl ${className}`}>
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
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="bg-white border border-dashed border-gray-200 rounded-xl py-16 px-6 text-center">
      {icon && (
        <div className="flex justify-center mb-3 text-gray-300">{icon}</div>
      )}
      <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
      {description && (
        <p className="text-xs text-gray-500 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FieldLabel({ children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {children}
      </label>
      {hint && <p className="text-xs text-gray-400 -mt-1 mb-1.5">{hint}</p>}
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
