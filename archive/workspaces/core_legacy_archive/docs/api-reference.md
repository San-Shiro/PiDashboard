# PiDashboard API Reference Guide

This document lists all available backend REST API endpoints exposed by the Bun host process of **PiDashboard** (running on port `3000` by default).

All `/api/` endpoints (except setup/login status endpoints) are protected by a session cookie gate and return a `401 Unauthorized` response if no valid session token exists in request cookies.

---

## 🔐 1. Authentication APIs

### Setup First Password
* **Route:** `POST /api/auth/setup`
* **Content-Type:** `application/json`
* **Body:**
  ```json
  {
    "password": "your-secure-password"
  }
  ```
* **Description:** Initializes the admin password (requires minimum 4 characters). Computes an Argon2id hash and writes it securely to `secrets/admin.passhash`. Only usable during first-run.
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

### Admin Login
* **Route:** `POST /api/auth/login`
* **Content-Type:** `application/json`
* **Body:**
  ```json
  {
    "password": "your-password"
  }
  ```
* **Description:** Validates credentials against `secrets/admin.passhash`. If successful, sets a secure HTTP cookie `session_token` valid for 7 days.
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

### Admin Logout
* **Route:** `POST /api/auth/logout`
* **Description:** Invalidate the current session token and expire the `session_token` cookie.
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

### Session & Config Status
* **Route:** `GET /api/auth/status`
* **Description:** Query if a user session is logged in, and whether the system first-run setup has been completed.
* **Response (200 OK):**
  ```json
  {
    "authenticated": true,
    "isAuthenticated": true,
    "isConfigured": true
  }
  ```

---

## 🎨 2. Canvas & Layout APIs

### Get Active Canvas
* **Route:** `GET /api/canvas/active`
* **Description:** Retrieves the currently displayed canvas layout configuration.
* **Response (200 OK):**
  ```json
  {
    "name": "Default Canvas",
    "width": 1280,
    "height": 720,
    "background": "#0a0a0a",
    "displayTarget": "primary",
    "widgets": []
  }
  ```

### Publish Canvas
* **Route:** `POST /api/canvas/publish`
* **Content-Type:** `application/json`
* **Body:** Canvas layout schema configuration.
* **Description:** Overwrites `canvases/active.json` atomically, re-hydrates scheduled widgets, and broadcasts a `reload` message to all connected kiosk WebSocket displays in under 200ms.
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

---

## 💾 3. Templates Preset APIs

### List Layout Presets
* **Route:** `GET /api/templates`
* **Description:** Get a list of all saved layout template presets.
* **Response (200 OK):**
  ```json
  {
    "templates": [
      {
        "id": "morning-dashboard",
        "name": "Morning Dashboard",
        "description": "Standard morning information widgets layout.",
        "canvas_config": {
          "width": 1280,
          "height": 720,
          "background": "#0c0f1d",
          "displayTarget": "primary"
        },
        "widget_count": 5,
        "updated_at": "2026-05-28T12:00:00.000Z",
        "is_active": false
      }
    ]
  }
  ```

### Save Current Canvas as Preset
* **Route:** `POST /api/templates`
* **Content-Type:** `application/json`
* **Body:**
  ```json
  {
    "name": "Evening Ambient",
    "description": "Minimal layout optimized for evening brightness levels.",
    "canvas_config": {
      "width": 1280,
      "height": 720,
      "background": "#050505"
    }
  }
  ```
* **Description:** Copies active widgets layout and saves them as a custom layout preset under `canvases/saved/<name>.json`.
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

### Apply Preset to Display
* **Route:** `POST /api/templates/:id/apply`
* **Description:** Overwrites the active canvas layout with the saved preset and triggers kiosk reloads instantly.
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

### Delete Preset
* **Route:** `DELETE /api/templates/:id`
* **Description:** Deletes the named preset JSON layout file.
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

---

## 🧱 4. Widget Registry & Instance APIs

### List Widget Registry
* **Route:** `GET /api/widgets/registry`
* **Description:** Returns all registered widget packages scanned from directories inside `widgets/` with their manifests.
* **Response (200 OK):**
  ```json
  {
    "widgets": [
      {
        "id": "clock",
        "name": "Digital Clock",
        "version": "1.0.0",
        "tier": "1a",
        "entrypoints": {
          "fragment": "fragment/clock.html"
        },
        "configSchema": [
          {
            "key": "showSeconds",
            "type": "boolean",
            "default": true,
            "label": "Show Seconds"
          }
        ]
      }
    ]
  }
  ```

### List Placed Widget Instances
* **Route:** `GET /api/widgets/instances`
* **Description:** Returns all layout instances currently placed on the active canvas.
* **Response (200 OK):**
  ```json
  {
    "instances": [
      {
        "id": "clock_1716912345678",
        "widget_id": "clock",
        "label": "Digital Clock",
        "enabled": true,
        "base_config": {
          "x": 40,
          "y": 40,
          "width": 300,
          "height": 100,
          "zIndex": 2,
          "opacity": 1.0,
          "activeFrom": "00:00",
          "activeTo": "23:59"
        },
        "widget_config": {
          "showSeconds": true,
          "format": "24h"
        },
        "manifest": {}
      }
    ]
  }
  ```

### Instantiate New Widget
* **Route:** `POST /api/widgets/instances`
* **Content-Type:** `application/json`
* **Body:**
  ```json
  {
    "widget_id": "clock"
  }
  ```
* **Description:** Instantiates a new widget item on the active canvas with standard baseline values and default configuration schema variables.
* **Response (200 OK):** Returns the newly created widget instance object.

### Update Widget Instance Config
* **Route:** `PATCH /api/widgets/instances/:id`
* **Content-Type:** `application/json`
* **Body:**
  ```json
  {
    "label": "Bedside Clock",
    "enabled": true,
    "base_config": {
      "x": 100,
      "y": 100,
      "width": 400,
      "height": 120
    },
    "widget_config": {
      "format": "12h"
    }
  }
  ```
* **Description:** Updates instance label, status, grid sizing (`base_config`), or widget custom variables (`widget_config`) and re-writes the active canvas layout dynamically.
* **Response (200 OK):** Returns the updated widget instance object.

### Delete Widget Instance
* **Route:** `DELETE /api/widgets/instances/:id`
* **Description:** Deletes the active widget instance from the layout canvas.
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

---

## 📁 5. Media Asset APIs

### List Uploaded Assets
* **Route:** `GET /api/media`
* **Description:** Lists files inside `/media/uploads/` ready for use in widgets.
* **Response (200 OK):**
  ```json
  [
    {
      "name": "bg-ambient.mp4",
      "size": 12450890,
      "type": "video/mp4",
      "updatedAt": "2026-05-28T14:30:00.000Z"
    }
  ]
  ```

### Upload Media Asset
* **Route:** `POST /api/media/upload`
* **Content-Type:** `multipart/form-data`
* **Body:** Uploaded file attached to key `"file"`.
* **Description:** Uploads file up to 50MB. Files are sanitized and written to `/media/uploads/`.
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "filename": "bg-ambient.mp4",
    "url": "/media/bg-ambient.mp4"
  }
  ```

### Delete Media Asset
* **Route:** `DELETE /api/media/:filename`
* **Description:** Removes media asset from the system directory.
* **Note:** Deletion fails and returns `400 Bad Request` if the asset filename is currently linked in active canvas widgets configs, preserving reference integrity.
* **Success Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

---

## ⚙️ 6. System & Status APIs

### Get Host Diagnostics
* **Route:** `GET /api/system/stats`
* **Description:** Retrieves real-time statistics of CPU load, RAM allocation, filesystem bounds, and system uptime.
* **Response (200 OK):**
  ```json
  {
    "cpu": {
      "load": 12.5,
      "temp": 48.2
    },
    "memory": {
      "total": 512,
      "free": 184,
      "used": 328
    },
    "disk": {
      "total": 7800,
      "free": 4350,
      "used": 3450
    },
    "uptime": 142080
  }
  ```

### Toggle Maintenance Mode
* **Route:** `POST/PATCH /api/system/state`
* **Content-Type:** `application/json`
* **Body:**
  ```json
  {
    "maintenanceMode": true
  }
  ```
* **Description:** Puts the system into Maintenance Standby, suspending all Tier 1b scheduled timers, stopping watchers, and forcing all connected displays onto a minimal static HTML page. Set to `false` to restore normal display operations.
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "display_enabled": true
  }
  ```
