# 08 — Interactive Widgets

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `compose.ts`, `index.ts`

---

## Architecture

Interactive widgets have **bidirectional** data flow:

```
DOWNLINK (server → widget):  Same as push tier. Daemon → IPC → Bun → WS → onData()
UPLINK (widget → server):    PiWidget.sendCommand() → WS → Bun → IPC .cmd.json → Daemon
```

---

## Uplink: Commands

### Client Side

```javascript
// Widget fragment sends a command:
PiWidget.sendCommand('mpd-player', 'toggle_play', {});
PiWidget.sendCommand('mpd-player', 'seek', { position: 0.75 });
```

**WS message format:**
```json
{
  "type": "widget_command",
  "widget": "mpd-player",
  "action": "toggle_play",
  "payload": {}
}
```

### Server Side: Command Router

```typescript
// In the WebSocket message handler
function handleWidgetCommand(widgetType: string, action: string, payload: any): void {
  // Step 1: Validate widget exists in registry
  const manifest = registryMap.get(widgetType);
  if (!manifest) {
    logger.warn('CMD', `Command for unknown widget: ${widgetType}`);
    return;
  }
  
  // Step 2: Validate action is declared in manifest
  const validActions = manifest.interactive?.commands?.map(c => c.action) || [];
  if (validActions.length > 0 && !validActions.includes(action)) {
    logger.warn('CMD', `Unknown action '${action}' for widget '${widgetType}'`);
    return;
  }
  
  // Step 3: Route to daemon via IPC command file
  const cmdPath = join(getIpcDir(), `${widgetType}.cmd.json`);
  const command = {
    action,
    payload,
    timestamp: Date.now()
  };
  
  try {
    writeFileSync(cmdPath, JSON.stringify(command), 'utf8');
    logger.debug('CMD', `Routed: ${widgetType}.${action}`);
  } catch (e) {
    logger.error('CMD', `Failed to write command file: ${e}`);
  }
}
```

### Daemon Side: Command Consumer

The daemon watches for `.cmd.json` files and processes them:

```
/tmp/widgets/mpd-player.json       ← Daemon writes: current state
/tmp/widgets/mpd-player.cmd.json   ← Server writes: user commands
```

**Daemon behavior:**
1. Watch for `.cmd.json` file appearance (or poll every 100ms)
2. Read and parse the command
3. Execute the action (e.g., send `pause` to MPD socket)
4. Delete the `.cmd.json` file after processing
5. Write updated state to the data `.json` file (downlink)

```python
# Example: MPD daemon command handler (pseudo-code)
def process_command(cmd):
    if cmd['action'] == 'toggle_play':
        if mpd.status() == 'playing':
            mpd.pause()
        else:
            mpd.play()
    elif cmd['action'] == 'seek':
        mpd.seekcur(cmd['payload']['position'] * song_duration)
    elif cmd['action'] == 'next':
        mpd.next()
    elif cmd['action'] == 'prev':
        mpd.previous()
    
    # After action: update state file (triggers downlink push)
    write_state_file()
```

### Command File Lifecycle

```
1. Widget button clicked → PiWidget.sendCommand()
2. WS message arrives at server
3. Server validates widget + action
4. Server writes /tmp/widgets/mpd-player.cmd.json
5. Daemon detects file, reads it
6. Daemon executes action
7. Daemon DELETES mpd-player.cmd.json
8. Daemon writes updated mpd-player.json (state)
9. Bun fs.watch detects state change
10. Bun pushes new state via WS
11. Widget's onData() fires with new state
12. UI updates (e.g., play icon → pause icon)
```

**Round-trip latency:** ~100-300ms total (WS + file write + daemon poll + file write + WS)

---

## State Persistence

### When to Persist

| Widget | Persist? | Why |
|:---|:---|:---|
| Notepad/tasks | ✅ Yes | User-entered text must survive restarts |
| Timer/stopwatch | ⚠️ Optional | Nice-to-have for accidental reloads |
| Music player | ❌ No | State comes from MPD daemon, not the widget |
| Photo slideshow | ❌ No | Navigation position is ephemeral |
| Home automation toggles | ❌ No | State reflects actual device state from daemon |

### Client Side

```javascript
// Save (debounced)
var saveTimer;
textarea.addEventListener('input', function() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    PiWidget.saveState(ctx.instanceId, { 
      text: textarea.value,
      lastEdited: Date.now()
    });
  }, 1000);
});

// Load (synchronous at init)
var saved = PiWidget.loadState(ctx.instanceId);
if (saved) textarea.value = saved.text;
```

### Server Side: State Handler

```typescript
function handleWidgetStateSave(instanceId: string, state: any): void {
  // Sanitize instance ID (prevent path traversal)
  const safeId = instanceId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) {
    logger.warn('STATE', `Invalid instance ID: ${instanceId}`);
    return;
  }
  
  const stateDir = join(process.cwd(), 'state', 'widgets');
  mkdirSync(stateDir, { recursive: true });
  
  const statePath = join(stateDir, `${safeId}.json`);
  
  // Size guard: reject state > 50KB
  const stateStr = JSON.stringify(state);
  if (stateStr.length > 50_000) {
    logger.warn('STATE', `State too large for ${safeId}: ${stateStr.length} bytes`);
    return;
  }
  
  // Atomic write
  const tmpPath = `${statePath}.tmp`;
  writeFileSync(tmpPath, stateStr, 'utf8');
  renameSync(tmpPath, statePath);
  
  logger.debug('STATE', `Saved state for ${safeId}: ${stateStr.length} bytes`);
}
```

### Compositor: State Embedding

At compose time, the compositor reads saved state and embeds it:

```typescript
function getWidgetState(instanceId: string): any | null {
  const statePath = join(process.cwd(), 'state', 'widgets', `${instanceId}.json`);
  if (!existsSync(statePath)) return null;
  
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

// In renderWidgetContainer:
const savedState = instance.interactive?.persistence ? getWidgetState(instance.id) : null;
// → embedded as data-state='...' attribute on the widget container
```

### State Storage Location

```
state/
  widgets/
    quick-notes_1780037948006.json    ← Instance-specific state
    timer_1780037950123.json
```

This directory is on disk (not tmpfs) — state must survive reboots.

---

## Potential Errors

| Error | Cause | Impact | Handling |
|:---|:---|:---|:---|
| Command dropped (WS disconnected) | Network issue | User clicks button, nothing happens | Widget should show visual feedback only after `onData` confirms new state, not optimistically |
| Command file not consumed | Daemon crashed or not running | `.cmd.json` piles up | Server could add a TTL (delete cmd files older than 30s on a cleanup timer) |
| Stale command executed | Daemon reads old `.cmd.json` after restart | Unexpected action | Include `timestamp` in command. Daemon should ignore commands older than 5s |
| State file grows unbounded | Widget saves too frequently or too much data | Disk fills up | 50KB size guard on save. Periodic cleanup for orphaned state files |
| Path traversal in instanceId | Malicious WS client sends `../../etc/passwd` | File overwrite | Sanitize to `[a-zA-Z0-9_-]` only |
| Concurrent command writes | Two users click simultaneously | Second write overwrites first | Acceptable — last command wins. For critical actions, daemon should debounce |
| `data-state` attribute too large | State > 10KB embedded in HTML | DOM parsing slowdown | Warn widget authors; consider separate state endpoint for large state |

---

## Code Reminders

- **Sanitize `instanceId` before any file operation.** This is user-influenced data (instance IDs come from the canvas config). Always strip to `[a-zA-Z0-9_-]`.
- **Commands are fire-and-forget.** There's no ACK message. The widget learns the result by observing the next `onData` push. Don't add a command-response protocol — it's unnecessary complexity for a kiosk dashboard.
- **Debounce `saveState` calls.** The SDK doesn't debounce internally — it's the widget's responsibility. A notepad saving on every keystroke would flood the WS channel. Recommend 1-second debounce in widget developer docs.
- **State files are not in tmpfs.** They're in `state/widgets/` on disk. This means writes are slower (~1ms vs ~0.01ms) but survive reboots. The 1-second debounce makes this a non-issue.
- **Test with daemon down.** The most common failure mode is the daemon not running. Commands pile up as `.cmd.json` files. The display shows stale data. This should be handled gracefully — no crashes, just stale UI.
