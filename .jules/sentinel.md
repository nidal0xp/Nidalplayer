## 2024-10-14 - Prevent Timing Attacks in Remote Access
**Vulnerability:** Timing attack vulnerability in desktop remote token verification due to standard string equality (`===`).
**Learning:** Checking string equality character-by-character allows attackers to measure response times and progressively guess the QR access token. Additionally, node.js `crypto.timingSafeEqual` expects `Buffer` or `TypedArray` of equal length; providing strings of unequal length throws a `TypeError`, potentially causing a Denial of Service (DoS).
**Prevention:** Convert tokens to `Buffer` using `Buffer.from()`, verify `expectedBuf.byteLength === suppliedBuf.byteLength` first, and then compare using `crypto.timingSafeEqual`.
