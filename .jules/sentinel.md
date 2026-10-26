## 2026-10-26 - Secure Electron Navigation and External Execution
**Vulnerability:** Electron allowed arbitrary protocols in shell.openExternal and lacked will-navigate / setWindowOpenHandler limits.
**Learning:** Insecure navigation handlers and IPC calls expose the application to protocol-based exploitation or arbitrary window creation.
**Prevention:** Always validate URL protocols and explicitly restrict unhandled navigations by allowing only specific protocols like file: or local hosts, wrapping them in try/catch blocks.
