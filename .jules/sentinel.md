## 2024-05-18 - [Timing Attack in Remote Access Token Verification]
**Vulnerability:** The remote access token check used the `===` operator for string comparison, making it vulnerable to a timing attack. An attacker could measure response times to guess the expected token.
**Learning:** `crypto.timingSafeEqual` should be used instead of `===` for sensitive token comparisons. However, a DoS vulnerability can be introduced if `crypto.timingSafeEqual` is called with Buffers of different lengths, as it throws an error. Also `string.length` is insufficient due to multi-byte characters.
**Prevention:** Always convert strings to Buffers using `Buffer.from(..., 'utf8')` and check if both Buffers have the same `byteLength` before calling `crypto.timingSafeEqual`.
