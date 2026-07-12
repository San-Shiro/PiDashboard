// Widget marketplace — Coming Soon placeholder
import { Card, SectionHeader } from "../ui-primitives";
import { ShoppingBag, Download, Settings, Star } from "lucide-react";

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <Card className="p-5 text-center">
      <div
        className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-3"
        style={{
          backgroundColor: "var(--color-surface-2)",
          color: "var(--color-text-secondary)",
        }}
      >
        <Icon size={18} />
      </div>
      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h3>
      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--color-text-muted)" }}
      >
        {description}
      </p>
    </Card>
  );
}

export default function MarketplaceTab() {
  return (
    <div className="space-y-8">
      {/* Coming Soon Hero */}
      <div
        className="rounded-2xl border relative overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute -top-24 -left-24 w-48 h-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ backgroundColor: "var(--color-accent)" }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full opacity-[0.04] blur-3xl"
          style={{ backgroundColor: "var(--color-warn)" }}
        />

        <div className="relative z-10 py-16 px-6 flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, var(--color-accent), var(--color-accent-hover, #818cf8))",
              color: "#FFFFFF",
            }}
          >
            <ShoppingBag size={30} />
          </div>

          <h2
            className="text-lg font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Widget Marketplace
          </h2>

          <p
            className="text-sm mt-2 max-w-md"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Community widgets, one-click install, auto-configured daemons.
          </p>

          <p
            className="text-xs mt-3 max-w-sm leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            Browse, install, and manage third-party widgets from the community.
            Coming in a future update.
          </p>

          <div
            className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold"
            style={{
              backgroundColor: "var(--color-accent-bg)",
              color: "var(--color-accent)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Coming Soon
          </div>
        </div>
      </div>

      {/* Feature Preview */}
      <div>
        <SectionHeader
          title="Planned features"
          subtitle="What to expect from the marketplace"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={Download}
            title="One-Click Install"
            description="Install widgets with a single tap. Automatic dependency resolution and setup."
          />
          <FeatureCard
            icon={Settings}
            title="Auto-Configure Daemons"
            description="Daemon-powered widgets automatically register and start their systemd services."
          />
          <FeatureCard
            icon={Star}
            title="Community Reviews"
            description="Rate and review widgets. See RAM estimates and compatibility info before installing."
          />
        </div>
      </div>
    </div>
  );
}
