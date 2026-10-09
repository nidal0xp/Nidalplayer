## 2024-05-24 - Accessibility improvements for Nidalplayer icon buttons
**Learning:** Found several icon-only buttons in the UI (HUD, Mini player) that lack proper `aria-label` attributes. Without these, screen readers won't announce the purpose of these buttons clearly.
**Action:** Always add descriptive `aria-label` attributes to buttons that only contain icons, emojis or text symbols (like ★, ⏯, 🔊, etc.) and no descriptive text, ensuring they are accessible to users relying on assistive technologies.
