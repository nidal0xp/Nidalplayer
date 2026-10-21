
## 2026-10-21 - Added ARIA labels to in-stream HUD controls
**Learning:** Icon-only playback controls inside embedded and fullscreen players (e.g., `.hud-btn-icon`, `.btn-mini-ctrl`) lack semantic meaning for screen readers, unlike text-based buttons.
**Action:** Always add explicit `aria-label` attributes to any new icon-only playback or navigation controls to ensure full accessibility.
