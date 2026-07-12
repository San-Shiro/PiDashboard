(function() {
  function usesCanvasTheme(cfg) {
    return !cfg || cfg.__themeMode !== "custom";
  }

  function normalizeGradientStops(bg, fallbackA, fallbackB) {
    var raw = (bg && Array.isArray(bg.stops) && bg.stops.length)
      ? bg.stops
      : [
          { color: (bg && bg.color) || fallbackA, position: 0 },
          { color: (bg && bg.color2) || fallbackB, position: 100 }
        ];
    return raw
      .map(function(stop, index) {
        var defaultColor = index === 0 ? fallbackA : fallbackB;
        var stopColor = (stop && stop.color) || defaultColor;
        var defaultPos = Math.round((index / Math.max(1, raw.length - 1)) * 100);
        var stopPos = (stop && stop.position !== undefined) ? Number(stop.position) : defaultPos;
        return {
          color: stopColor,
          position: Math.max(0, Math.min(100, stopPos))
        };
      })
      .sort(function(a, b) { return a.position - b.position; });
  }

  function buildBackgroundFromShape(background, colorA, colorB) {
    var bg = background || { type: "classic" };
    if (bg.type === "transparent") return "transparent";
    if (bg.type !== "gradient") return colorA;
    if (Array.isArray(bg.stops) && bg.stops.length) {
      var first = (bg.stops[0] && bg.stops[0].color) || colorA;
      var last = (bg.stops[bg.stops.length - 1] && bg.stops[bg.stops.length - 1].color) || colorB;
      var stopList = normalizeGradientStops(bg, first, last).map(function(stop) {
        return stop.color + " " + stop.position + "%";
      }).join(", ");
      if (bg.gradientType === "radial") return "radial-gradient(circle, " + stopList + ")";
      return "linear-gradient(" + (bg.angle || 135) + "deg, " + stopList + ")";
    }
    var mix = Math.max(0, Math.min(100, Number(bg.mix !== undefined ? bg.mix : 50)));
    var softness = Math.max(0, Math.min(100, Number(bg.softness !== undefined ? bg.softness : 100)));
    var half = softness / 2;
    var stopA = Math.max(0, Math.min(100, mix - half));
    var stopB = Math.max(0, Math.min(100, mix + half));
    if (bg.gradientType === "radial") {
      return "radial-gradient(circle, " + colorA + " 0%, " + colorA + " " + stopA + "%, " + colorB + " " + stopB + "%, " + colorB + " 100%)";
    }
    return "linear-gradient(" + (bg.angle || 135) + "deg, " + colorA + " 0%, " + colorA + " " + stopA + "%, " + colorB + " " + stopB + "%, " + colorB + " 100%)";
  }

  function legacySoftGradient(bg, fallbackA, fallbackB) {
    var mix = Math.max(0, Math.min(100, Number(bg.mix !== undefined ? bg.mix : 50)));
    var softness = Math.max(0, Math.min(100, Number(bg.softness !== undefined ? bg.softness : 100)));
    var half = softness / 2;
    var stopA = Math.max(0, Math.min(100, mix - half));
    var stopB = Math.max(0, Math.min(100, mix + half));
    var colorA = (bg && bg.color) || fallbackA;
    var colorB = (bg && bg.color2) || fallbackB;
    if (bg.gradientType === "radial") {
      return "radial-gradient(circle, " + colorA + " 0%, " + colorA + " " + stopA + "%, " + colorB + " " + stopB + "%, " + colorB + " 100%)";
    }
    return "linear-gradient(" + (bg.angle || 135) + "deg, " + colorA + " 0%, " + colorA + " " + stopA + "%, " + colorB + " " + stopB + "%, " + colorB + " 100%)";
  }

  function renderBackgroundStyle(background, fallbackA, fallbackB) {
    var bg = background || { type: "classic", color: fallbackA };
    if (bg.type !== "gradient") return bg.color || fallbackA;
    if (Array.isArray(bg.stops) && bg.stops.length) {
      var stopList = normalizeGradientStops(bg, fallbackA, fallbackB).map(function(stop) {
        return stop.color + " " + stop.position + "%";
      }).join(", ");
      if (bg.gradientType === "radial") return "radial-gradient(circle, " + stopList + ")";
      return "linear-gradient(" + (bg.angle || 135) + "deg, " + stopList + ")";
    }
    return legacySoftGradient(bg, fallbackA, fallbackB);
  }

  window.PiTheme = {
    usesCanvasTheme: usesCanvasTheme,
    
    getColor: function(cfg, customValue, cssVar, fallback) {
      return usesCanvasTheme(cfg)
        ? "var(" + cssVar + ", " + fallback + ")"
        : (customValue || fallback);
    },

    getBackground: function(cfg, customBackground, fallbackA, fallbackB, themedFallback) {
      if (usesCanvasTheme(cfg)) {
        var themeA = "color-mix(in srgb, var(--canvas-surface, #1a1a2e) 88%, transparent)";
        var themeB = "color-mix(in srgb, var(--canvas-accent, #6366f1) 18%, var(--canvas-surface, #1a1a2e))";
        return customBackground
          ? buildBackgroundFromShape(customBackground, themeA, themeB)
          : (themedFallback || buildBackgroundFromShape(null, themeA, themeB));
      }
      return renderBackgroundStyle(customBackground, fallbackA, fallbackB);
    },

    normalizeBoxValues: function(value, fallback) {
      var base = fallback || { top: 0, right: 0, bottom: 0, left: 0 };
      return {
        top: Number(value && value.top !== undefined ? value.top : base.top),
        right: Number(value && value.right !== undefined ? value.right : base.right),
        bottom: Number(value && value.bottom !== undefined ? value.bottom : base.bottom),
        left: Number(value && value.left !== undefined ? value.left : base.left)
      };
    }
  };
})();
