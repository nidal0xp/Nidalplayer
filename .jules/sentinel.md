## 2023-10-25 - Prevent Timing Attack in Remote Authentication
**Vulnerability:** The application was using the standard '===' operator for token comparison in 'hasRemoteAccess', which creates a timing attack vulnerability allowing an attacker to guess tokens character by character.
**Learning:** Node.js 'crypto.timingSafeEqual' should be used for secret comparisons, and both buffers must be checked for identical 'byteLength' before comparison. Checking '.length' on strings can lead to DoS vulnerabilities if multi-byte characters are provided.
**Prevention:** Always use 'crypto.timingSafeEqual' for comparing tokens, passwords, or secrets in Node.js, and strictly validate buffer byte lengths before comparing.
