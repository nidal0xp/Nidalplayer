## 2024-10-18 - Timing Safe Token Verification
**Vulnerability:** Timing attack vulnerability in remote access token verification due to standard string equality (`===`).
**Learning:** Standard string equality (`===`) fails fast, leaking the length of the matched prefix. Attackers can use this timing information to guess the token character by character. Also, when mitigating this using `crypto.timingSafeEqual`, relying on string `.length` is insufficient due to multi-byte characters and will cause a `TypeError` leading to a DoS vulnerability.
**Prevention:** Always use `crypto.timingSafeEqual` for comparing secrets, and ensure that both buffers have the exact same `byteLength` before comparison.
