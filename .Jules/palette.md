## 2024-05-24 - Icon-Only Button Accessibility
**Learning:** Found that multiple icon-only buttons (like 'X' close buttons on modals and clear search inputs) were completely unlabelled for screen readers, meaning users would only hear 'button' or confusing generic text.
**Action:** Always add descriptive `aria-label` attributes to icon-only buttons to ensure clear navigation for users relying on assistive technology.
