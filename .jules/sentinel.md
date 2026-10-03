## 2024-10-24 - [Electron Web Navigation Restrictions]
**Vulnerability:** Electron apps are susceptible to RCE and external link vulnerabilities through unrestricted `shell.openExternal` and lack of controls over `will-navigate` and `setWindowOpenHandler` on `webContents`.
**Learning:** In applications utilizing local files for the UI (`loadFile()`), strictly blocking all unapproved protocols in `will-navigate` blocks internal navigation (`file:` protocol) making the app unusable.
**Prevention:** Explicitly allowlist `file:` and `localhost` hostnames when securing `will-navigate` in Electron applications using `loadFile()` to keep internal navigation functional while blocking external malicious payloads.
