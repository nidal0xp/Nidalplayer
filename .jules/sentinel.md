## 2026-10-20 - Secure Electron Navigation and External Links
**Vulnerability:** Missing navigation restrictions and open-external URL validation.
**Learning:** Malformed or unauthorized URLs could lead to RCE or open unauthorized paths, and navigating to non-local origins within the app bypasses intended app constraints.
**Prevention:** Use will-navigate to restrict to localhost/file, setWindowOpenHandler to open external URLs safely, and validate open-external IPC URLs via URL objects with a try-catch.
