## 2025-02-14 - [Navigation Controls for webSecurity Bypass]
**Vulnerability:** Arbitrary navigation and shell execution due to missing window controls with `webSecurity: false`.
**Learning:** In Electron, bypassing CORS for media streaming (`webSecurity: false`) opens up cross-site scripting risks where untrusted content could potentially navigate the window to remote locations or open malicious links via `open-external` IPC if it gets executed.
**Prevention:** Always pair `webSecurity: false` with strict navigation filtering via `setWindowOpenHandler` (deny all arbitrary window creations), `will-navigate` (allow only `file:`, `localhost`), and IPC sanitization (enforce protocols like `http:`/`https:` on `shell.openExternal()`).
