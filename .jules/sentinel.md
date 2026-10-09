## 2024-05-24 - Unmanaged External Link Risk
**Vulnerability:** External link navigation in Electron (`shell.openExternal` and `target="_blank"`) didn't restrict protocols, exposing a remote code execution risk using schemes like `file://` or `smb://`.
**Learning:** `shell.openExternal` blindly passes protocols to the OS. Setting `allowRunningInsecureContent: true` combined with unrestricted `openExternal` is dangerous.
**Prevention:** Always restrict `shell.openExternal` and `window.open` handlers to explicitly allow-listed safe protocols (e.g. `http:` and `https:`).
