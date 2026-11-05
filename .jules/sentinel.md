## 2024-11-05 - Avoid Timing Attacks in Token Verification
**Vulnerability:** Manual loop-based string comparison in `tokensMatch` could be vulnerable to timing attacks as string comparisons can terminate early.
**Learning:** The manual loop comparing characters using XOR does not mitigate timing side-channels at the JS engine or lower levels properly, and relying on `string.length` is insufficient when mitigating timing attacks with `crypto.timingSafeEqual` as multi-byte characters could cause mismatches between length and byte length.
**Prevention:** Use `crypto.timingSafeEqual(a, b)` for all token/secret comparison logic, and ensure both buffers have the exact same `byteLength` before comparing to avoid `TypeError`.
