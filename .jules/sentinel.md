## 2024-05-18 - Fix timing attack vulnerability in remote security token validation
**Vulnerability:** DoS and timing attack vulnerabilities due to comparing token strings with `===` and relying on string `.length`.
**Learning:** `crypto.timingSafeEqual` prevents timing attacks, but it throws a `TypeError` if the two buffers don't have the same `byteLength`. String `.length` is insufficient due to multi-byte characters, leading to potential DoS vulnerabilities.
**Prevention:** Always convert strings to buffers using `Buffer.from(..., 'utf8')` and compare their `byteLength` before calling `crypto.timingSafeEqual`.
