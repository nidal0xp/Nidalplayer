## 2026-10-17 - Timing Attack Vulnerability in Remote Access Token
**Vulnerability:** The remote access token validation logic used strict string equality (`===`) instead of a constant-time comparison, making it susceptible to timing attacks.
**Learning:** Using `crypto.timingSafeEqual` mitigates timing attacks. Furthermore, always verify that both buffers have the exact same `byteLength` before comparison to prevent a `TypeError` (which can lead to a Denial of Service) due to multi-byte characters when using string `.length`.
**Prevention:** In Node.js, always use `crypto.timingSafeEqual` along with a `byteLength` check for any sensitive token/password comparisons.
