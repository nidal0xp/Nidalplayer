## 2024-05-24 - Missing Keyboard Focus Feedback
**Learning:** The application extensively uses `outline: none;` on inputs, buttons, and select dropdowns, which completely removes visual feedback for keyboard users and breaks navigation accessibility. Standard focus outlines must not be removed without providing a fallback.
**Action:** Implemented a global `:focus-visible` rule in the core design system using the `--accent-orange` token with `!important` to override all instances of `outline: none`, ensuring robust keyboard navigation across the entire application.
