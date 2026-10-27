## 2023-10-27 - Timing Attack in Remote Authorization
**Vulnerability:** The remote access token comparison (`suppliedToken === expectedToken`) was vulnerable to timing attacks, allowing an attacker to guess the token byte-by-byte.
**Learning:** Using simple string equality (`===`) for secrets in Node.js exposes them to timing side-channels. Relying on string `.length` for mitigating timing attacks is insufficient and causes `TypeError` DoS vulnerabilities when buffer lengths differ due to multi-byte characters.
**Prevention:** Use `crypto.timingSafeEqual` with a strict `byteLength` check (`bufExpected.byteLength === bufSupplied.byteLength`) before comparing buffers to securely verify tokens and prevent DoS.
