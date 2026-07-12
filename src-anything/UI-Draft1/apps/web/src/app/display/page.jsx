// Kiosk display page — what WPE WebKit points at in full-screen.
// Reads layout from /api/widgets/instances and polls widget data sources.
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { WidgetRenderer } from "@/components/dashboard/widget-renderers";
import useWidgetData from "@/components/dashboard/use-widget-data";

function isWidgetActive(base) {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const current = `${h}:${m}`;
  if (!base.activeFrom || !base.activeTo) return true;
  if (base.activeFrom === "00:00" && base.activeTo === "23:59") return true;
  return current >= base.activeFrom && current <= base.activeTo;
}

export default function DisplayPage() {
  const [scale, setScale] = useState(1);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: instancesData } = useQuery({
    queryKey: ["display-instances"],
    queryFn: async () => {
      const r = await fetch("/api/widgets/instances");
      if (!r.ok) throw new Error("instances");
      return r.json();
    },
    refetchInterval: 10000,
  });

  // Fetch active template for canvas dimensions
  const { data: templatesData } = useQuery({
    queryKey: ["display-canvas-config"],
    queryFn: async () => {
      const r = await fetch("/api/templates");
      if (!r.ok) return null;
      return r.json();
    },
    refetchInterval: 15000,
  });

  const { data: sysState } = useQuery({
    queryKey: ["display-state"],
    queryFn: async () => {
      const r = await fetch("/api/system/state");
      if (!r.ok) throw new Error("state");
      return r.json();
    },
    refetchInterval: 5000,
  });

  const activeTemplate = (templatesData?.templates || []).find(
    (t) => t.is_active,
  );
  const canvasW = activeTemplate?.canvas_config?.width || 1280;
  const canvasH = activeTemplate?.canvas_config?.height || 720;
  const canvasBg = activeTemplate?.canvas_config?.background || "#0a0a0a";

  useEffect(() => {
    const updateScale = () => {
      const s = Math.min(
        window.innerWidth / canvasW,
        window.innerHeight / canvasH,
      );
      setScale(s);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [canvasW, canvasH]);

  const instances = instancesData?.instances || [];
  const maintenance = sysState?.maintenance_mode || false;
  const displayOff = sysState?.display_enabled === false;

  const visibleInstances = instances.filter(
    (i) => i.enabled && isWidgetActive(i.base_config || {}),
  );
  const activeWidgetIds = Array.from(
    new Set(
      visibleInstances.filter((i) => !maintenance).map((i) => i.widget_id),
    ),
  );
  const widgetData = useWidgetData(activeWidgetIds);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <a
        href="/"
        style={{
          position: "fixed",
          top: 12,
          right: 16,
          fontSize: 11,
          color: "rgba(255,255,255,0.2)",
          textDecoration: "none",
          zIndex: 100,
          fontFamily: "ui-sans-serif, sans-serif",
          letterSpacing: "0.05em",
        }}
        onMouseEnter={(e) => (e.target.style.color = "rgba(255,255,255,0.55)")}
        onMouseLeave={(e) => (e.target.style.color = "rgba(255,255,255,0.2)")}
      >
        ⚙ admin
      </a>

      {displayOff && (
        <div
          style={{
            color: "rgba(255,255,255,0.15)",
            fontFamily: "ui-sans-serif, sans-serif",
            fontSize: 14,
          }}
        >
          Screen turned off
        </div>
      )}

      {!displayOff && maintenance && (
        <div
          style={{
            color: "rgba(255,255,255,0.4)",
            fontFamily: "ui-sans-serif, sans-serif",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 42, marginBottom: 12 }}>🔧</div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>Maintenance mode</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
            Display paused — admin panel has priority compute
          </div>
        </div>
      )}

      {!displayOff && !maintenance && (
        <div
          style={{
            position: "relative",
            width: canvasW,
            height: canvasH,
            backgroundColor: canvasBg,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.35) 100%)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />

          {visibleInstances.map((instance) => {
            const base = instance.base_config || {};
            return (
              <div
                key={instance.id}
                style={{
                  position: "absolute",
                  left: base.x,
                  top: base.y,
                  width: base.width,
                  height: base.height,
                  opacity: base.opacity ?? 1,
                  zIndex: base.zIndex || 10,
                  fontFamily: "ui-sans-serif, -apple-system, sans-serif",
                  overflow: "hidden",
                }}
              >
                <WidgetRenderer
                  instance={instance}
                  widgetData={widgetData}
                  now={now}
                />
              </div>
            );
          })}

          {visibleInstances.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.25)",
                fontFamily: "ui-sans-serif, sans-serif",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>📺</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>
                No widgets active right now
              </div>
              <div style={{ fontSize: 13, marginTop: 6, opacity: 0.6 }}>
                Open the admin panel to configure your display
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
