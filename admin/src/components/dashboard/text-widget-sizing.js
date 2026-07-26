const AUTO_SIZE_TEXT_WIDGET_IDS = new Set(["text-title", "text-paragraph"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeMeasureNode() {
  if (typeof document === "undefined") return null;
  const node = document.createElement("div");
  node.style.position = "fixed";
  node.style.left = "-99999px";
  node.style.top = "-99999px";
  node.style.visibility = "hidden";
  node.style.pointerEvents = "none";
  node.style.boxSizing = "border-box";
  node.style.margin = "0";
  node.style.padding = "0";
  node.style.border = "0";
  document.body.appendChild(node);
  return node;
}

export function isAutoSizeTextWidget(widgetId) {
  return AUTO_SIZE_TEXT_WIDGET_IDS.has(widgetId);
}

export function measureTextWidgetLayout(widgetId, cfg = {}, canvasW = 1920, canvasH = 1080, currentLayout = {}) {
  const isTitle = widgetId === "text-title";
  const text = String(
    cfg.textContent || (isTitle ? "Your Title" : "Add paragraph content here.")
  );
  const fontSize = Number(cfg.fontSize || (isTitle ? 64 : 24));
  const lineHeight = Number(cfg.lineHeight || (isTitle ? 1.1 : 1.5));
  const letterSpacing = Number(cfg.letterSpacing || 0);
  const fontWeight = String(cfg.fontWeight || (isTitle ? "800" : "400"));
  const fontFamily = cfg.fontFamily || (isTitle ? "Inter, system-ui, sans-serif" : "system-ui, sans-serif");
  const whiteSpace = isTitle
    ? (cfg.wrap === false ? "pre" : "pre-wrap")
    : "pre-wrap";
  const wordBreak = "break-word";
  const requestedWidth = Number(cfg.textWidth || 0);

  let width = currentLayout.width || (isTitle ? 640 : 700);
  let height = currentLayout.height || (isTitle ? 170 : 280);

  const node = makeMeasureNode();
  if (!node) {
    return { width, height };
  }

  try {
    node.textContent = text;
    node.style.fontFamily = fontFamily;
    node.style.fontSize = `${fontSize}px`;
    node.style.fontWeight = fontWeight;
    node.style.fontStyle = cfg.italic ? "italic" : "normal";
    node.style.lineHeight = String(lineHeight);
    node.style.letterSpacing = `${letterSpacing}px`;
    node.style.textTransform = cfg.transform || "none";
    node.style.whiteSpace = whiteSpace;
    node.style.wordBreak = wordBreak;

    if (isTitle) {
      node.style.display = "inline-block";
      node.style.width = requestedWidth > 0 ? `${requestedWidth}px` : "auto";
      node.style.maxWidth = `${Math.max(120, Math.min(canvasW - (currentLayout.x || 0), requestedWidth > 0 ? requestedWidth : canvasW))}px`;
      width = Math.ceil(node.getBoundingClientRect().width);
      height = Math.ceil(node.getBoundingClientRect().height);
    } else {
      const currentWidth = currentLayout.width || 0;
      const heuristicWidth = Math.max(
        260,
        Math.min(canvasW * 0.72, Math.max(fontSize * 16, Math.sqrt(text.length || 1) * fontSize * 1.45, currentWidth))
      );
      const targetWidth = requestedWidth > 0 ? requestedWidth : heuristicWidth;
      node.style.display = "block";
      node.style.width = `${targetWidth}px`;
      node.style.maxWidth = `${Math.max(260, Math.min(canvasW - (currentLayout.x || 0), targetWidth))}px`;
      width = Math.ceil(node.getBoundingClientRect().width);
      height = Math.ceil(node.getBoundingClientRect().height);
    }

    if (!isTitle) {
      const maxLines = Number(cfg.maxLines || 0);
      if (maxLines > 0) {
        height = Math.min(height, Math.ceil(fontSize * lineHeight * maxLines + 2));
      }
    }

    width = clamp(Math.ceil(width + 2), isTitle ? 80 : 180, Math.max(80, canvasW - (currentLayout.x || 0)));
    height = clamp(Math.ceil(height + 2), Math.ceil(fontSize * lineHeight), Math.max(40, canvasH - (currentLayout.y || 0)));
  } finally {
    node.remove();
  }

  return { width, height };
}
