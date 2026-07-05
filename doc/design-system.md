# Design system — "New Element / Iron Man" HUD

The look of the whole extension (popup, permission page, on-page overlay)
follows the sci-fi design system documented in detail in
[`../DESIGN.md`](../DESIGN.md). This file summarizes only the parts actually
applied in the extension's code and where to find them.

## Principles applied

- **Dark background as the base**: near-black panels (`#09090b`/`#18181b`),
  color is an event (badges, glow), not the background.
- **A single accent**: blue (`#3b82f6` blue-500, `#60a5fa` blue-400,
  `#58a6ff` HUD accent). Red is reserved for error states, never used as a
  generic "active" color.
- **Glass (glassmorphism)**: every floating surface is semi-transparent +
  `backdrop-blur`, with a thin white border `border-white/10` (or the
  equivalent `rgba(255,255,255,0.1-0.12)` in plain CSS, since the extension
  doesn't use Tailwind but hand-written CSS).
- **Light communicates state**: every "on" element has a glow
  `box-shadow: 0 0 8px rgba(color, 0.8)` (or stronger for emphasized states
  like the pinch).
- **Soft motion**: CSS transitions of `0.1s`–`0.35s`, never instant.

## Where it's implemented

| Element | File | Notes |
|---|---|---|
| Virtual cursor (`#handnav-cursor`) | `content.css` | Blue circle with glow, `handnav-pinch` (blue-300, shrunk scale) and `handnav-scroll` (HUD blue `#58a6ff`, wider glow) states; pulses on click (`handnav-click-pulse`, blue) and on right-click (`handnav-rightclick-pulse`, indigo) |
| Status badge (`#handnav-badge`) | `content.css` | Glass pill with a glowing blue dot, uppercase mono font with letter-spacing |
| On-page context menu (`#handnav-menu`) | `content.css` | Dark glass panel with a translucent blue border and diffuse glow; entries in uppercase mono font, blue hover |
| Popup (`popup.html`/`popup.css`) | `popup.css` | Same palette and principles (see the file header: *"Design system 'New Element / Iron Man' — sci-fi HUD"*) |

## Palette used in the on-page overlay

| Role | Color |
|---|---|
| Standard cursor (border/glow) | `rgba(59, 130, 246, x)` — blue-500 |
| Cursor while pinching | `rgba(147, 197, 253, x)` — blue-300 |
| Cursor while scrolling | `rgba(88, 166, 255, x)` — HUD accent `#58a6ff` |
| Right-click pulse | `rgba(129, 140, 248, x)` — indigo-400 |
| Badge/menu glass background | `rgba(9, 9, 11, 0.72–0.92)` + `backdrop-filter: blur(12–14px)` |
| Menu border | `rgba(88, 166, 255, 0.35)` |

For the full tokens (typography, spacing, z-index, motion, 3D scene, shaders)
see sections 1–13 of [`../DESIGN.md`](../DESIGN.md); sections 9–11 (3D
motion, Three.js scene, shaders) are **not applicable** to this extension,
which has no 3D scene — they're relevant only if you want to replicate the
same style in another project with a 3D environment.
