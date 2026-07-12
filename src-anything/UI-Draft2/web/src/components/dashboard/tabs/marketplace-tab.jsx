// Widget marketplace (future phase 8) — UI scaffolded with placeholder entries.
import { Card, Pill, SectionHeader, EmptyState } from "../ui-primitives";
import { ShoppingBag, Download } from "lucide-react";

const PLACEHOLDER_WIDGETS = [
  {
    id: "spotify-now-playing",
    name: "Spotify Now Playing",
    author: "community",
    description: "Pull current track from Spotify Connect API with album art",
    version: "0.3.1",
    category: "media",
    estimatedRamMb: 8,
    installed: false,
  },
  {
    id: "calendar-agenda",
    name: "Calendar Agenda",
    author: "community",
    description: "Show upcoming Google Calendar events for the day",
    version: "1.2.0",
    category: "data",
    estimatedRamMb: 6,
    installed: false,
  },
  {
    id: "rss-headlines",
    name: "RSS Headlines",
    author: "core",
    description: "Cycle through headlines from any RSS feed",
    version: "1.0.0",
    category: "data",
    estimatedRamMb: 3,
    installed: false,
  },
  {
    id: "stock-ticker",
    name: "Stock Ticker",
    author: "community",
    description: "Live price ticker for selected stocks and crypto",
    version: "0.8.0",
    category: "data",
    estimatedRamMb: 5,
    installed: false,
  },
];

export default function MarketplaceTab() {
  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
        <ShoppingBag size={16} className="text-amber-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-900">
            Marketplace preview
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Browse-only for now. Phase 8 will add one-click installation that
            downloads packages, registers systemd services, and adds them to
            autostart.
          </p>
        </div>
      </div>

      <SectionHeader
        title="Available widgets"
        subtitle="Community and core widgets ready to install"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLACEHOLDER_WIDGETS.map((w) => (
          <Card key={w.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {w.name}
                  </h3>
                  <span className="text-xs text-gray-400 font-mono">
                    v{w.version}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{w.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              <Pill>{w.category}</Pill>
              <Pill>{w.estimatedRamMb} MB</Pill>
              <Pill>by {w.author}</Pill>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <button
                disabled
                className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-400 cursor-not-allowed rounded-lg px-3 py-1.5 text-xs font-medium"
                title="Coming in phase 8"
              >
                <Download size={11} />
                Install (coming soon)
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
