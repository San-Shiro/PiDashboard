# User Guide & Operations

This guide provides detailed instructions on how to use the Web Admin Control Panel to manage layout arrangements, publish canvases, configure custom widgets, and control kiosk display states.

---

## 🔐 1. Authentication & Setup

When accessing the Web Admin Panel for the first time, you will be prompted with a setup screen to establish your security password.

- **First-Run Setup:**
  - Navigate to the admin address (e.g. `http://pi.local/`).
  - Input your new password. The server computes a secure Argon2 hash and saves it atomically to `secrets/admin.passhash`.
- **Admin Login:**
  - Input your configured password.
  - The server signs an HTTP secure cookie. All API operations require this session gate.
  - *To lock the panel:* Click the "Lock Screen" button in the navigation footer to clear secure cookies immediately.

---

## 🎨 2. The Layout Editor

The **Layout Editor** tab is a fully interactive canvas builder running client-side. It offloads all grid calculations from the Pi, keeping system CPU costs at zero.

- **Adding Widgets:**
  - Open the "Widgets" drawer from the sidebar.
  - Click on any registered widget (e.g., Monospace Clock, Weather, System Monitor) to instantiate it on the canvas.
- **Manipulating Placements:**
  - **Drag and Drop:** Click and hold a widget to move it around the canvas grid area.
  - **Resizing:** Grab the bottom-right corner anchor of any widget instance to scale its dimensions.
  - **Z-Index Controls:** Adjust layering levels of overlapping widgets using z-index sliders.
  - **Opacity Slider:** Control blending layers (0.0 to 1.0) for video backdrops or glassmorphic elements.
- **Dynamic Configuration Forms:**
  - Selecting any active widget displays its customizable fields in the configuration panel. These forms are generated dynamically by reading the widget's manifest JSON (e.g., toggling 12h/24h time, inputting weather locations, or tweaking polling schedules).

---

## 💾 3. Templates & Canvas Management

PiDashboard separates saved designs (**Templates**) from what is currently rendering on the kiosk (**Active Canvas**).

- **Save as Template:**
  - Give your active layout a descriptive name and click "Save Template".
  - This saves the layout JSON array directly to `/core/canvases/saved/<name>.json`.
- **Applying Canvas Templates:**
  - The "Templates" tab displays a list of all your saved canvas presets (e.g., standard, morning, night, dashboard).
  - Click "Apply Preset" to instantly swap the layout editor workspace to that preset.
- **Save & Publish:**
  - Client-side manipulations are purely local and do not touch the active display.
  - Click the **Save & Publish** button to write the workspace configuration atomically to `/core/canvases/active.json`.
  - The server immediately recomposes the kiosk HTML document and pushes a WebSocket reload command to update all physical kiosk screens in under 200ms.

---

## 📁 4. Media Asset Manager

The **Media** tab allows users to upload local static assets (images, videos, custom layout backgrounds, web fonts) directly to the server.

- **Uploading Assets:**
  - Drag and drop files (up to 50MB) or select files manually.
  - The server parses file contents, filters malicious executable script tags, and writes the asset securely to `/core/media/uploads/`.
- **Reference Integrity Verification:**
  - Before a media asset is deleted, the media manager API cross-references the filename against the active canvas configurations inside `/core/canvases/active.json`.
  - If the asset is currently in use as a widget background, the delete button is blocked to prevent broken asset links on active kiosk screens.

---

## ⚙️ 5. Kiosk Maintenance Mode

When performing system upgrades or low-power cycles, you can toggle **Maintenance Mode** with a single click.

> [!NOTE]
> Maintenance Mode is specifically designed to drop the Pi Zero 2W's RSS memory usage on demand.

- **Entering Maintenance Mode:**
  - Click "Enter Maintenance" in the System tab.
  - The Bun server suspends all scheduled Tier 1b background fetch intervals, halts IPC watchers, and instructs Tier 2 daemons to standby.
  - A WebSocket alert causes connected kiosk displays to instantly switch to a minimal, static HTML overlay page, freeing up layout DOM elements and active memory buffers.
- **Exiting Maintenance Mode:**
  - Click "Resume Display" in the Web Admin panel.
  - The server reactivates fetch timers, restarts watchers, and sends a reload socket message to kiosk clients, restoring standard display grids instantly.
