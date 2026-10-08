## 2025-02-12 - Missing ARIA Labels on Icon-only controls
**Learning:** Icon-only playback controls that rely on text symbols lacking default semantics (like '▶' and '⏹') often miss ARIA labels, creating a poor experience for screen reader users.
**Action:** When adding or auditing icon-only buttons, check for explicit `aria-label` attributes to ensure they are accessible.
