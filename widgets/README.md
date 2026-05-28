# PiDashboard Widget Fragment Directory

This directory contains standalone, highly modular widget packages optimized for the smart kiosk dashboard.

## Terminology Conventions

- **Fragment**: A widget's self-contained HTML/CSS/JS file. Fragments must use vanilla JavaScript DOM operations and custom CSS styles scoped under the parent `[data-widget="<id>"]` container. No heavy external dependencies are permitted.
- **Canvas**: An active layout arrangement JSON configuration defining widget placements.
- **Template**: A named canvas preset (e.g., standard, morning, night) that can be saved, exported, or activated.

## Widget Structure

Each widget is placed in its own subdirectory containing a manifest and dynamic assets:

```
widgets/<widget-id>/
├── manifest.json
├── fragment/
│   └── <entrypoint>.html
└── fetch/              # (Optional: Tier 1b Bun fetch modules)
    └── <fetcher>.ts
```
