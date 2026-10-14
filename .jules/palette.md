## 2026-10-14 - Add ARIA Labels to Icon-Only Buttons
**Learning:** The application's custom modals (e.g., `.btn-modal-close`) and icon-only UI elements often rely purely on raw text symbols (e.g., '✕') lacking default semantics, necessitating the manual addition of `aria-label` or `aria-hidden` attributes for proper accessibility.
**Action:** When adding new icon-only buttons or custom modals using text symbols, always verify and include a descriptive `aria-label`.
