## 2024-10-24 - Missing ARIA Labels on Icon Buttons
**Learning:** The application heavily relies on Unicode glyphs (e.g., ⛶, ▦, ▤, 👁, ★) instead of SVGs for numerous interactive controls (HUD buttons, view toggles, mini player). These lack inherent semantic meaning for screen readers.
**Action:** Ensure all new icon-only buttons receive an explicit `aria-label`. Use `title` for visual tooltips, but do not rely on it alone for accessibility.
