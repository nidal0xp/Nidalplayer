
## 2024-10-28 - Secure String Comparison for Remote Access Token
**Vulnerability:** Timing attack vulnerability in remote access token comparison.
**Learning:** String comparison using `===` exits early on character mismatch, making it vulnerable to timing attacks. To prevent timing attacks, cryptographic string comparisons should use `crypto.timingSafeEqual`, which compares two buffers in constant time regardless of mismatches. Note that we must check `byteLength` (not string length) before comparing to avoid a TypeError that could crash the server.
**Prevention:** Always use `crypto.timingSafeEqual` with matched `byteLength` buffers for comparing security tokens or passwords.
