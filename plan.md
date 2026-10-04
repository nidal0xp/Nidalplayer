1. **Identify Buttons needing `aria-label`:** In `index.html`, find all buttons that are primarily icon-based and lack `aria-label` or need a descriptive one for better accessibility. These include `btn-mini-ctrl`, `btn-tool`, `hud-btn-icon`, `settingToggleTmdbKeyVisBtn`, `liveGridBtn`, `liveListBtn`.
2. **Add `aria-label`:** Update these buttons to include an appropriate `aria-label` matching their purpose or `title` attributes if present.
3. **Verify:** Run the application or load `index.html` to make sure changes do not break functionality or UI layout. Run tests `pnpm test`.
4. **Pre-commit and Review:** Follow pre-commit instructions, then create PR.
