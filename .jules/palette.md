## 2026-10-25 - Accessibility of Icon-Only Buttons and Labels
**Learning:** The application's custom modals and icon-only UI elements (e.g., in the HUD and mini-player) frequently lack default semantics, necessitating the manual addition of `aria-label` attributes. Additionally, some form labels are missing the `for` attribute.
**Action:** Always ensure that icon-only buttons have an `aria-label` and form labels are explicitly associated with their input elements using the `for` attribute to ensure proper screen reader accessibility.
