## 2026-10-22 - Fix timing attack vulnerability in remoteToken
**Vulnerability:** Timing attack vulnerability in remote access token comparison.
**Learning:** String comparison `===` is not constant-time and can be exploited to guess tokens byte-by-byte.
**Prevention:** Use `crypto.timingSafeEqual` for sensitive tokens, but ensure exact `byteLength` matching of Buffers beforehand to prevent DoS via `TypeError`.
