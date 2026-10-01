## 2024-10-01 - [Electron WebPreferences Misconfiguration]
**Vulnerability:** Found `webSecurity: false` and `allowRunningInsecureContent: true` enabled in the `main.js` `BrowserWindow` `webPreferences` configuration.
**Learning:** This is likely an oversight to avoid CORS issues for M3U payloads which can be fetched from external domains, or to allow loading of insecure HTTP streams over HTTPS. This disabled basic Electron application security against XSS/CSRF allowing untrusted sources to take advantage.
**Prevention:** Avoid disabling `webSecurity` and permitting insecure content execution on apps dealing directly with web protocols in the future.
