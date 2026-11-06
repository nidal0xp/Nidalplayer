## 2026-11-06 - Prevent Sandbox Escape via window navigation
**Vulnerability:** mainWindow.webContents lacked will-navigate and setWindowOpenHandler restrictions.
**Learning:** Even with webSecurity and sandbox enabled, a renderer could navigate the top-level frame to a malicious site or open uncontrolled target='_blank' popups, breaking app isolation.
**Prevention:** Always explicitly define setWindowOpenHandler (action: 'deny' or controlled shell.openExternal) and hook will-navigate to restrict allowed protocols/hosts in Electron.
