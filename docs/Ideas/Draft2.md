
Yes, it’s possible — but I’d strongly separate two ideas:

## 1. “No normal desktop OS” — yes, good idea

This is realistic.

You can make the Pi behave like a dedicated appliance, similar in spirit to WLED:
```text
power on
→ boot minimal Linux
→ start your signage app
→ app renders display
→ app hosts local web config page
```
The user never sees a desktop, terminal, taskbar, browser, etc.

This is the path I’d recommend.

## 2. “No OS at all / bare metal” — technically possible, but not worth it

This would mean writing directly for the Raspberry Pi hardware, almost like firmware.

For your project, that becomes very hard because you need:

- HDMI output
- audio output
- video decoding
- Wi-Fi
- file system access
- USB
- web server
- image/video formats
- networking
- config saving
- maybe hardware acceleration

On a Raspberry Pi, those things are much easier through Linux. Without Linux, you’d be fighting drivers and GPU firmware instead of building the thing you actually want.

So the better version is:

> Not “no OS”, but “a tiny hidden OS that only runs my app.”

That is how many commercial signage boxes work.

---

# Could C++ or Rust handle the rendering?

Yes. That’s actually a strong path.

A custom renderer written in **C++** or **Rust** could be much lighter than Chromium.

Instead of rendering HTML/CSS in a browser, your app could read a config file like:
```json
{
  "widgets": [
    {
      "type": "image",
      "src": "media/background.jpg",
      "x": 0,
      "y": 0,
      "width": 1280,
      "height": 720,
      "zIndex": 0,
      "opacity": 1
    },
    {
      "type": "video",
      "src": "media/ad.mp4",
      "x": 100,
      "y": 80,
      "width": 800,
      "height": 450,
      "zIndex": 2,
      "opacity": 0.9
    },
    {
      "type": "clock",
      "x": 950,
      "y": 40,
      "width": 260,
      "height": 80,
      "zIndex": 5,
      "opacity": 1
    }
  ]
}
```
Then your app draws everything itself.

That can be much faster and lighter than a browser.

---

# But video is the hard part

Images, text, rectangles, clocks, and opacity are easy.

Video is where it gets tricky.

If you build your own renderer, you need a way to decode and display video. You probably do **not** want to write video decoding yourself.

You would use one of these under the hood:

## Option A: `mpv` / `libmpv`

Very good option.

Your app can use `mpv` as the video playback engine and control it from C++/Rust.

Pros:

- good video support
- can use hardware acceleration if set up correctly
- reliable
- easier than building your own video player

Cons:

- layering video with other widgets can get more complex
- transparent overlays may need careful rendering design

## Option B: GStreamer

Powerful, but more complex.

Pros:

- very flexible
- good for video pipelines
- can handle camera streams, local video, network streams

Cons:

- steeper learning curve
- more moving pieces

## Option C: SDL2 + image/text rendering + external video layer

Use SDL2 for the canvas and something else for video.

Pros:

- fairly simple for images/text/shapes
- good C++ support
- can run without a desktop

Cons:

- video integration still needs another tool/library

## Option D: OpenGL ES / DRM/KMS

This is the “proper” low-level renderer path.

Pros:

- no desktop needed
- direct display output
- efficient
- best long-term if you want a real appliance

Cons:

- harder to build
- more graphics knowledge needed

---

# The best realistic architecture

If you want something custom, light, and appliance-like, I’d build it like this:
```text
Raspberry Pi Zero 2 W
│
├── Minimal Linux
│   └── no desktop
│
├── signage-renderer
│   ├── written in Rust or C++
│   ├── starts automatically on boot
│   ├── reads layout.json
│   ├── renders widgets to screen
│   ├── plays video/audio
│   └── watches for config changes
│
├── signage-admin-server
│   ├── tiny local web server
│   ├── serves admin page to phone/laptop
│   ├── accepts media uploads
│   └── saves layout.json
│
└── media folder
    ├── images
    ├── videos
    └── fonts
```
Your monitor shows the renderer.

Your phone/laptop opens:
```text
http://pi.local
```
to edit the layout.

The admin page could still be a web page, but it runs in your phone/laptop browser. The Pi only serves it and saves the config.

---

# Rust vs C++

For your case:

## Rust

Great if you want safety and a clean long-term project.

Good choices:

- Rust app for renderer
- `axum` or `tiny-http` for local admin server
- `serde_json` for config files
- maybe `wgpu`, `pixels`, `smithay`, SDL bindings, or DRM/KMS bindings for graphics

Pros:

- memory-safe
- modern
- good for long-running appliance software
- nice JSON/config handling

Cons:

- graphics/video ecosystem can be more awkward than C++
- cross-compiling for Pi can take setup

## C++

Probably easier for media/rendering.

Good choices:

- SDL2
- OpenGL ES
- mpv/libmpv
- GStreamer
- Dear ImGui if you ever want an on-screen debug UI

Pros:

- better low-level media support
- more examples for Raspberry Pi rendering
- closer to hardware/media libraries

Cons:

- memory bugs are easier to create
- project can get messy if not structured well

My recommendation:

> Use **C++** if video/rendering is the priority.  
> Use **Rust** if reliability/config/server structure is the priority.

A hybrid is also possible:
```text
Rust server/config manager
C++ renderer/video player
```
But for a first version, keep it one language.

---

# Would Pi Zero 2 W handle this better than browser kiosk?

Potentially yes.

A custom renderer can be lighter than Chromium.

Approx idea:
```text
Chromium kiosk approach:
- easier to build
- heavier RAM usage
- layout is easy with HTML/CSS
- video/audio easy
- more overhead

Custom C++/Rust renderer:
- harder to build
- much lighter if done well
- more control
- better appliance feel
- video integration harder
```
For Pi Zero 2 W, a custom renderer could absolutely be better.

But only if you keep the feature set controlled.

---

# What I would build first

Do **not** start with the full dream system.

Start with a small “proof of concept”:

## Version 0.1

- boot minimal Linux
- app starts automatically
- reads `layout.json`
- displays:
  - background image
  - text widget
  - clock widget
- hosts tiny web page to edit JSON
- saves config
- renderer reloads config

No video yet.

## Version 0.2

- add image slideshow widget
- add opacity
- add z-index
- add start/end time rules

## Version 0.3

- add one fullscreen video widget
- audio output
- H.264 MP4 only

## Version 0.4

- add rectangular video widget
- overlays above video
- remote media upload

That order avoids drowning in video complexity too early.

---

# Minimal OS choices

If you want to drop “general OS feeling” but not go bare metal, look at:

## Easiest
```text
Raspberry Pi OS Lite 32-bit
```
Then remove/disable everything you don’t need.

Best for first prototype.

## More appliance-like
```text
Buildroot
```
This builds a tiny custom Linux image with only your app and needed libraries.

Very WLED-like in spirit.

Pros:

- very small
- fast boot
- controlled image
- appliance-style

Cons:

- harder setup
- updates/package management are more manual

## More industrial
```text
Yocto
```
Powerful, but probably overkill for you right now.

---

# Important reality check

WLED works the way it does because it runs on microcontrollers and controls LEDs. That is much simpler than:
```text
decode video
render images
play audio
serve web UI
drive HDMI/VGA monitor
handle Wi-Fi
```
Your project is closer to a **custom digital signage appliance** than WLED.

So yes, you can make it feel like WLED from the user’s point of view:
```text
connect to device
open local web page
edit settings
save
display updates
```
But internally, a Pi should still run a tiny Linux base.

---

# My recommendation

For your goal, I’d choose this path:
```text
Raspberry Pi OS Lite 32-bit first
→ custom C++ renderer
→ mpv/libmpv or GStreamer for video
→ tiny local web server for config
→ JSON config files
→ later move to Buildroot if you want a true appliance image
```
That gives you the best balance:

- light enough for Pi Zero 2 W
- custom and controllable
- not stuck with Chromium
- still practical
- can support video/audio
- can have local web editing

So the answer is:

> Yes, a custom C++/Rust renderer is possible, and it can be lighter than FullPageOS/Chromium. But don’t go fully bare-metal. Use a tiny Linux base and make your app the only thing the Pi runs.

If you want, I can help you design the first clean config format and the pieces your renderer would need before you choose C++ or Rust.