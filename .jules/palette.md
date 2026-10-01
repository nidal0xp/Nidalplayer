## 2024-10-18 - Missing ARIA Labels on Icon-only Modals and Inputs
**Learning:** Custom modals (e.g., `.btn-modal-close`) and icon-only UI elements (e.g., clear search button) in the app often rely purely on raw text symbols (e.g., '✕') lacking default semantics. Without explicit `aria-label`s, screen readers cannot communicate their function.
**Action:** Always ensure any icon-only button, especially those using non-semantic text symbols like '✕', has an appropriate `aria-label` attribute (e.g., `aria-label="Close"`) applied to provide screen reader accessibility.
