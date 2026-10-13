## 2024-10-13 - Mitigate Timing Attacks in Remote Security
**Vulnerability:** Timing attack on remote access token comparison.
**Learning:** `crypto.timingSafeEqual` should be used instead of regular string equality operators (`===`) when verifying tokens to prevent attackers from determining correct characters via timing side-channels. Buffer `byteLength` must be identical before calling `crypto.timingSafeEqual` otherwise it will throw a `TypeError` and crash the process, potentially causing a DoS. String `.length` check is insufficient due to multi-byte characters affecting byte length.
**Prevention:** Always use `crypto.timingSafeEqual` for sensitive token comparisons and ensure both items compared are Buffers and share exactly the same `byteLength`.
