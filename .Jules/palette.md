## 2024-05-24 - Missing Keyboard Focus Feedback
**Learning:** The application extensively uses `outline: none;` on inputs, buttons, and select dropdowns, which completely removes visual feedback for keyboard users and breaks navigation accessibility. Standard focus outlines must not be removed without providing a fallback.
**Action:** Implemented a global `:focus-visible` rule in the core design system using the `--accent-orange` token with `!important` to override all instances of `outline: none`, ensuring robust keyboard navigation across the entire application.

## 2024-05-24 - Icon-Only Button & Input Accessibility
**Learning:** Found that multiple icon-only buttons (like 'X' close buttons on modals and clear search inputs) and search input were completely unlabelled for screen readers, meaning users would only hear 'button' or confusing generic text. Decorative symbols (like the '⌕' reticle) could also confuse screen readers.
**Action:** Always add descriptive `aria-label` attributes to icon-only buttons and inputs, and add `aria-hidden="true"` to decorative symbols to ensure clear navigation for users relying on assistive technology.

