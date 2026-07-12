import { useEffect, useState, useRef, useCallback } from "react";

// Polls each known widget data source at its own cadence and exposes
// the latest payloads as a {widget_id: data} dictionary.
// Used by both the display page and the layout preview canvas.

const POLL_INTERVALS = {
  weather: 60000,
  lyrics: 2000,
  sysinfo: 5000,
  automation: 10000,
};

export default function useWidgetData(activeWidgetIds = []) {
  const [data, setData] = useState({});
  const refs = useRef({});

  const fetchOne = useCallback(async (name) => {
    try {
      const res = await fetch(`/api/widget-data/${name}`);
      if (!res.ok) return;
      const payload = await res.json();
      setData((prev) => ({ ...prev, [name]: payload }));
    } catch (e) {
      // Stale data is preserved — never wipe last-known-good on error.
    }
  }, []);

  useEffect(() => {
    // Reset polling timers when active widget set changes
    Object.values(refs.current).forEach(clearInterval);
    refs.current = {};

    for (const name of activeWidgetIds) {
      const interval = POLL_INTERVALS[name];
      if (!interval) continue;
      fetchOne(name);
      refs.current[name] = setInterval(() => fetchOne(name), interval);
    }
    return () => Object.values(refs.current).forEach(clearInterval);
  }, [activeWidgetIds.join("|"), fetchOne]);

  return data;
}
