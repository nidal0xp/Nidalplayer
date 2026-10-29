## 2026-10-29 - Timing Attack in Remote Token Validation
**Vulnerability:** String equality comparison (`===`) was used for secure token validation in `src/desktop/remoteSecurity.js`.
**Learning:** Relying on string `.length` for Buffer creation is insufficient due to multi-byte characters. Using `===` is vulnerable to timing attacks, and mismatched byte lengths cause `crypto.timingSafeEqual` to throw a TypeError DoS.
**Prevention:** Convert to Buffers first, verify `byteLength` is exactly equal, and use `crypto.timingSafeEqual`.
