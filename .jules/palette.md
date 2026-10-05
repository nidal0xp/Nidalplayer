## 2024-10-05 - Added missing aria-labels to icon-only buttons
**Learning:** Many icon-only control buttons in the app's HUD and preview docks lacked aria-labels, which breaks screen reader accessibility since they only use pure text symbols. They must have aria-labels added.
**Action:** Add aria-label attributes to any new icon-only buttons created in the UI to ensure keyboard/screen reader accessibility.
