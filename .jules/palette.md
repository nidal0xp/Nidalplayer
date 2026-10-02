## 2024-05-18 - Missing ARIA Labels on Custom Icon Buttons
**Learning:** This application extensively uses raw text symbols like "✕" for custom modal close buttons (`.btn-modal-close`) and clear buttons. Screen readers cannot interpret these raw symbols effectively, leading to poor keyboard/screen reader navigation context.
**Action:** Always add `aria-label="Close"` or appropriate descriptive text to `.btn-modal-close` and other icon-only buttons that rely on text symbols rather than SVG/icon fonts with semantic markup.
