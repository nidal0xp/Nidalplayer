## 2024-05-18 - [HIGH] Prevent timing attacks in remote access token comparison
**Vulnerability:** The remote access API used a simple string comparison (`===`) to validate authorization tokens, which is vulnerable to timing attacks. An attacker could potentially measure response times to guess the token character by character.
**Learning:** In Node.js, mitigating timing attacks with `crypto.timingSafeEqual` requires ensuring both strings are converted to Buffers, and explicitly verifying their `byteLength` before comparison. Relying on string `.length` can cause a `TypeError` due to multi-byte characters and lead to a DoS vulnerability.
**Prevention:** Always use `crypto.timingSafeEqual` with `Buffer.from()` and `byteLength` checks for comparing sensitive tokens or secrets.
