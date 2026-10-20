## 2026-10-20 - Missing ARIA Labels on Icon-Only HUD Controls
**Learning:** The application's custom media HUD uses native DOM elements with raw text symbols lacking default semantics, necessitating manual addition of aria-labels.
**Action:** Add aria-label attributes mapping to their title attributes for all such raw text icon controls to enable screen reader accessibility.
