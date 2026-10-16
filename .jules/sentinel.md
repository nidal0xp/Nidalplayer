## 2026-10-16 - [Navigation Security Hardening]
**Vulnerability:** Arbitrary navigation and window creation were allowed, and `shell.openExternal` accepted unvalidated protocol strings.
**Learning:** Default Electron configurations allow the renderer to arbitrarily change the main window's URL or open malicious OS protocols (e.g., `smb://`, `file://`) via IPC if compromised.
**Prevention:** Always implement `will-navigate` to restrict main frame navigation to trusted domains (e.g., `file:`, `localhost`), use `setWindowOpenHandler` to block new window creation and route safe `http/https` links to the default browser, and strictly validate URL protocols inside `open-external` IPC handlers using `try...catch(new URL())`.
