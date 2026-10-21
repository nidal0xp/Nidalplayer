## 2024-05-18 - [Timing Attack in Token Validation]
**Vulnerability:** A simple string comparison `suppliedToken === expectedToken` was used to validate the remote access token, which is susceptible to timing attacks.
**Learning:** Timing attacks can reveal valid tokens character by character. Using `crypto.timingSafeEqual` prevents this by ensuring comparison time is constant regardless of where the mismatch occurs. Additionally, checking `byteLength` instead of `.length` before `timingSafeEqual` is crucial to prevent `TypeError` DoS due to multi-byte characters.
**Prevention:** Always use constant-time comparison functions (like `crypto.timingSafeEqual` in Node.js) for security tokens, passwords, or HMAC signatures. Ensure buffer byte lengths match before comparison to prevent crashes.
