## 2026-10-11 - Missing ARIA labels on Icon-only UI Elements
**Learning:** Raw text symbol buttons like "⏯", "⏪", and "⛶" in Nidalplayer often lack screen-reader support because they only use `title` attributes.
**Action:** Always add `aria-label` attributes to such icon-only buttons to ensure they are accessible to assistive technologies.
