## 2026-10-24 - ARIA labels for icon-only buttons
**Learning:** The application extensively uses raw text symbols (e.g., '✕', '⛶') for custom modals and icon-only UI elements which lack default semantics, necessitating the manual addition of `aria-label` or `aria-hidden` attributes for proper accessibility.
**Action:** Always add `aria-label` attributes to button elements containing only non-semantic icon texts to ensure screen reader accessibility.
