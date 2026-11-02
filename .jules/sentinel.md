## 2024-11-02 - Prevent Timing Attacks and DoS in Remote Token Verification
**Vulnerability:** A simple string equality operator (`===`) was used to compare remote access tokens in `hasRemoteAccess`, introducing a timing attack vulnerability.
**Learning:** Comparing tokens this way exposes timing differences. Also, naive string length comparisons are unreliable due to multi-byte characters.
**Prevention:** Use `crypto.timingSafeEqual` with a preceding check that `expectedBuf.byteLength === suppliedBuf.byteLength` to guarantee uniform execution time and avoid `TypeError` exceptions.
