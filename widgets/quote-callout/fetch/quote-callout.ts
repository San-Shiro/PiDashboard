type QuoteConfig = Record<string, any>;

function resolvePath(source: any, pathSpec: string): any {
  if (source == null) return undefined;
  const paths = String(pathSpec || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!paths.length) return undefined;

  for (const path of paths) {
    let cursor = source;
    const parts = path.split(".").map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      if (cursor == null) break;
      cursor = cursor[part];
    }
    if (cursor !== undefined && cursor !== null && String(cursor).trim() !== "") return cursor;
  }
  return undefined;
}

function normalizePayload(payload: any): any {
  if (Array.isArray(payload)) {
    if (!payload.length) return {};
    return payload[Math.floor(Math.random() * payload.length)] || {};
  }
  if (payload && Array.isArray(payload.results) && payload.results.length) {
    return payload.results[Math.floor(Math.random() * payload.results.length)] || payload;
  }
  if (typeof payload === "string") {
    return { quote: payload };
  }
  return payload || {};
}

async function fetchRemoteQuote(cfg: QuoteConfig) {
  const sourceUrl = String(cfg.sourceUrl || "").trim();
  if (!sourceUrl) return null;

  const response = await fetch(sourceUrl, {
    headers: {
      accept: "application/json,text/plain,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(`Quote source request failed (${response.status})`);
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const payload = contentType.includes("application/json") || contentType.includes("+json")
    ? await response.json()
    : await response.text();
  const normalized = normalizePayload(payload);

  const quote = resolvePath(normalized, cfg.quotePath || "content|quote|text|body");
  const author = resolvePath(normalized, cfg.authorPath || "author|name|by");
  const source = resolvePath(normalized, "source|origin|book|publication");

  return {
    quote: String(quote || "").trim(),
    author: String(author || "").trim(),
    source: String(source || "").trim(),
  };
}

export async function fetchData(config: QuoteConfig) {
  const cfg = config || {};
  const manualQuote = String(cfg.quoteText || "Small moments of clarity compound into better work.").trim();
  const manualAuthor = String(cfg.author || "PiDashboard").trim();
  const manualSource = String(cfg.source || "").trim();
  const sourceUrl = String(cfg.sourceUrl || "").trim();
  const remoteMode = cfg.sourceMode === "remote";

  if (!remoteMode) {
    return {
      sourceMode: "manual",
      sourceUrl,
      quote: manualQuote,
      author: manualAuthor,
      source: manualSource,
      status: "Manual source",
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const remote = await fetchRemoteQuote(cfg);
    if (remote && remote.quote) {
      return {
        sourceMode: "remote",
        sourceUrl,
        quote: remote.quote,
        author: remote.author || manualAuthor,
        source: remote.source || manualSource || sourceUrl,
        status: "Updated just now",
        updatedAt: new Date().toISOString(),
      };
    }
  } catch {
    // fall through to manual fallback
  }

  return {
    sourceMode: "remote",
    sourceUrl,
    quote: manualQuote,
    author: manualAuthor,
    source: manualSource || sourceUrl,
    status: "Using manual fallback",
    updatedAt: new Date().toISOString(),
  };
}
