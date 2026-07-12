// Widget renderers — used on both the kiosk display page AND in the
// admin layout preview. Each renderer accepts (instance, data) where
// instance has widget_config and base_config, and data is the latest
// payload from /api/widget-data/<name>.

const WEATHER_ICONS = {
  "cloud-sun": "⛅",
  sun: "☀️",
  cloud: "☁️",
  rain: "🌧️",
  snow: "❄️",
  storm: "⛈️",
  fog: "🌫️",
};

function formatTime(date, format) {
  const h24 = date.getHours();
  const h12 = h24 % 12 || 12;
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  const ampm = h24 < 12 ? "AM" : "PM";
  if (format === "hh:mm A") return `${h12}:${mm} ${ampm}`;
  if (format === "HH:mm:ss")
    return `${h24.toString().padStart(2, "0")}:${mm}:${ss}`;
  return `${h24.toString().padStart(2, "0")}:${mm}`;
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Clock ───────────────────────────────────────────────────────────────────
export function ClockRenderer({ instance, now }) {
  const cfg = instance.widget_config || {};
  const time = now || new Date();
  return (
    <div style={{ color: cfg.color || "#fff" }}>
      <div
        style={{
          fontSize: cfg.fontSize || 64,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {formatTime(time, cfg.format || "HH:mm")}
      </div>
      {cfg.showDate && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 400,
            opacity: 0.6,
            marginTop: 6,
            letterSpacing: "0.02em",
          }}
        >
          {formatDate(time)}
        </div>
      )}
    </div>
  );
}

// ─── Weather ─────────────────────────────────────────────────────────────────
export function WeatherRenderer({ instance, data }) {
  const cfg = instance.widget_config || {};
  if (!data) {
    return (
      <div style={{ color: cfg.color || "#fff", fontSize: 13, opacity: 0.5 }}>
        Fetching weather…
      </div>
    );
  }
  const emoji = WEATHER_ICONS[data.icon] || "🌤️";
  const unit = cfg.units === "imperial" ? "F" : "C";
  const temp =
    cfg.units === "imperial" ? Math.round((data.temp * 9) / 5 + 32) : data.temp;
  const feels =
    cfg.units === "imperial"
      ? Math.round((data.feels_like * 9) / 5 + 32)
      : data.feels_like;
  return (
    <div style={{ color: cfg.color || "#fff" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <span style={{ fontSize: 40 }}>{emoji}</span>
        <div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {temp}°{unit}
          </div>
          {cfg.showFeelsLike && (
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
              Feels {feels}°{unit}
            </div>
          )}
        </div>
      </div>
      <div
        style={{ marginTop: 8, fontSize: 13, opacity: 0.8, fontWeight: 500 }}
      >
        {data.condition}
      </div>
      <div
        style={{
          marginTop: 4,
          display: "flex",
          gap: 12,
          fontSize: 11,
          opacity: 0.55,
        }}
      >
        {cfg.showHumidity && <span>💧 {data.humidity}%</span>}
        {data.wind_kph && <span>💨 {data.wind_kph} km/h</span>}
        {cfg.city && <span>{cfg.city}</span>}
      </div>
    </div>
  );
}

// ─── Lyrics / Now Playing ────────────────────────────────────────────────────
export function LyricsRenderer({ instance, data }) {
  const cfg = instance.widget_config || {};
  if (!data) {
    return (
      <div
        style={{ color: cfg.lyricsColor || "#fff", fontSize: 13, opacity: 0.4 }}
      >
        No track playing
      </div>
    );
  }
  const progressPct = Math.min(100, Math.round((data.progress || 0) * 100));
  const lines = cfg.linesToShow ?? 2;
  return (
    <div
      style={{
        color: cfg.lyricsColor || "#fff",
        display: "flex",
        gap: 14,
        alignItems: "stretch",
      }}
    >
      {cfg.showAlbumArt && (
        <div
          style={{
            width: 64,
            height: 64,
            flexShrink: 0,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
          }}
        >
          🎵
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
            color: cfg.metaColor || "#A1A1AA",
          }}
        >
          <span
            style={{
              fontSize: 11,
              opacity: 0.7,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Now Playing
          </span>
          <span style={{ fontSize: 11, opacity: 0.4 }}>·</span>
          <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>
            {data.artist}
          </span>
          <span style={{ fontSize: 11, opacity: 0.4 }}>·</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{data.title}</span>
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {data.current_line}
        </div>
        {lines >= 2 && data.next_line && (
          <div
            style={{
              fontSize: 15,
              opacity: 0.4,
              marginTop: 3,
              fontWeight: 400,
            }}
          >
            {data.next_line}
          </div>
        )}
        {cfg.showProgressBar && (
          <div
            style={{
              marginTop: 8,
              height: 2,
              width: "100%",
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                backgroundColor: "rgba(255,255,255,0.6)",
                borderRadius: 2,
                transition: "width 0.5s linear",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── System Info ─────────────────────────────────────────────────────────────
export function SysinfoRenderer({ instance, data }) {
  const cfg = instance.widget_config || {};
  if (!data) {
    return (
      <div style={{ color: cfg.color || "#fff", fontSize: 11, opacity: 0.4 }}>
        Collecting stats…
      </div>
    );
  }
  const ramPct = Math.round((data.mem_used_mb / data.mem_total_mb) * 100);
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - ramPct / 100);
  const temp =
    cfg.tempUnit === "F"
      ? Math.round(((data.cpu_temp * 9) / 5 + 32) * 10) / 10
      : data.cpu_temp;
  return (
    <div style={{ color: cfg.color || "#fff" }}>
      <div
        style={{
          fontSize: 10,
          opacity: 0.45,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        System
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {cfg.showRam && (
          <div style={{ position: "relative", width: 44, height: 44 }}>
            <svg width={44} height={44} viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
              />
              <circle
                cx="22"
                cy="22"
                r={r}
                fill="none"
                stroke="#EA580C"
                strokeWidth="3"
                strokeDasharray={`${circ}`}
                strokeDashoffset={dash}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700 }}>{ramPct}%</span>
            </div>
          </div>
        )}
        <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.8 }}>
          {cfg.showCpuTemp && (
            <div>
              🌡️ {temp}°{cfg.tempUnit || "C"}
            </div>
          )}
          {cfg.showCpuPercent && <div>⚙️ {data.cpu_percent}% CPU</div>}
          {cfg.showRam && (
            <div>
              💾 {data.mem_used_mb} / {data.mem_total_mb} MB
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Automation ──────────────────────────────────────────────────────────────
export function AutomationRenderer({ instance, data }) {
  const cfg = instance.widget_config || {};
  if (!data) return null;
  return (
    <div style={{ color: cfg.color || "#fff" }}>
      <div
        style={{
          fontSize: 10,
          opacity: 0.45,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        Home
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{data.lights_on ? "💡" : "🌑"}</span>
        <div>
          {cfg.showScene && (
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {data.scene} scene
            </div>
          )}
          {cfg.showNextEvent && data.next_event && (
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
              {data.next_event}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Image / Slideshow ───────────────────────────────────────────────────────
export function ImageRenderer({ instance }) {
  const cfg = instance.widget_config || {};
  const src = cfg.source;
  if (!src) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: cfg.borderRadius || 0,
          color: "rgba(255,255,255,0.3)",
          fontSize: 11,
        }}
      >
        No image set
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        objectFit: cfg.fit || "cover",
        borderRadius: cfg.borderRadius || 0,
        display: "block",
      }}
    />
  );
}

// ─── Renderer router ─────────────────────────────────────────────────────────
export function WidgetRenderer({ instance, widgetData, now }) {
  const wid = instance.widget_id;
  if (wid === "clock") return <ClockRenderer instance={instance} now={now} />;
  if (wid === "weather")
    return <WeatherRenderer instance={instance} data={widgetData?.weather} />;
  if (wid === "lyrics")
    return <LyricsRenderer instance={instance} data={widgetData?.lyrics} />;
  if (wid === "sysinfo")
    return <SysinfoRenderer instance={instance} data={widgetData?.sysinfo} />;
  if (wid === "automation")
    return (
      <AutomationRenderer instance={instance} data={widgetData?.automation} />
    );
  if (wid === "image") return <ImageRenderer instance={instance} />;
  return (
    <div
      style={{
        color: "rgba(255,255,255,0.4)",
        fontSize: 11,
        fontFamily: "ui-sans-serif, sans-serif",
      }}
    >
      Unknown widget: {wid}
    </div>
  );
}
