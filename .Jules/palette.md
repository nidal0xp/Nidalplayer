## 2024-05-18 - Missing ARIA Labels on Icon-Only Inputs & Modals
**Learning:** This app heavily uses custom modal close buttons (`.btn-modal-close`) and text input search clear buttons that rely purely on symbols (e.g., "✕"). They lack default semantics, and previously screen readers had no context for these interactions.
**Action:** When working on modals or icon-only actions in this specific codebase, proactively verify that `aria-label` or `title` tags are provided, and that decorative typography elements (like the `⌕` search reticle) receive `aria-hidden="true"`.
