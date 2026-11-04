## 2026-11-04 - [Missing Electron Navigation Limits]
**Vulnerability:** The application was missing constraints on where the internal renderer could navigate to (missing `will-navigate` interception) and lacked a `setWindowOpenHandler` definition, potentially allowing untrusted navigation or popups from embedded content (like M3U metadata or API payloads).
**Learning:** Default Electron configurations allow the main window to navigate to external URLs or open new windows without explicit limits.
**Prevention:** Always define `will-navigate` to restrict internal navigation to safe protocols (`file:`, `localhost`), and implement a secure `setWindowOpenHandler` that denies internal window creation and delegates links to `shell.openExternal`.
