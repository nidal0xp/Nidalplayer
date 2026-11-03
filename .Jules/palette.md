## 2024-05-24 - Missing Keyboard Focus Feedback
**Learning:** The application extensively uses `outline: none;` on inputs, buttons, and select dropdowns, which completely removes visual feedback for keyboard users and breaks navigation accessibility. Standard focus outlines must not be removed without providing a fallback.
**Action:** Implemented a global `:focus-visible` rule in the core design system using the `--accent-orange` token with `!important` to override all instances of `outline: none`, ensuring robust keyboard navigation across the entire application.

## 2024-05-24 - Icon-Only Button & Input Accessibility
**Learning:** Found that multiple icon-only buttons (like 'X' close buttons on modals and clear search inputs) and search input were completely unlabelled for screen readers, meaning users would only hear 'button' or confusing generic text. Decorative symbols (like the '⌕' reticle) could also confuse screen readers.
**Action:** Always add descriptive `aria-label` attributes to icon-only buttons and inputs, and add `aria-hidden="true"` to decorative symbols to ensure clear navigation for users relying on assistive technology.


## 2024-05-24 - Missing `for` attributes on Form Labels
**Learning:** Found that multiple form labels in the configuration sections (such as those for selecting the primary playback engine, application language, and TMDB API key) were missing the `for` attribute required to associate them with their corresponding input or select elements, which breaks screen reader accessibility and reduces the clickable area for users.
**Action:** Always ensure that every `<label>` element includes a `for` attribute whose value exactly matches the `id` of its corresponding `<input>`, `<select>`, or `<button>` to guarantee full accessibility and improve usability.
