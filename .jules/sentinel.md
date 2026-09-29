## 2026-09-29 - [Enable Electron WebSecurity]
**Vulnerability:** Disabled webSecurity and allowRunningInsecureContent flags in main.js exposed the app to severe cross-origin and mixed content attacks.
**Learning:** In Electron, developers often disable webSecurity as a quick workaround for CORS, but it entirely disables the Same-Origin Policy in the renderer.
**Prevention:** Never disable webSecurity in production Electron applications. Find secure CORS solutions using main process proxying if necessary.
