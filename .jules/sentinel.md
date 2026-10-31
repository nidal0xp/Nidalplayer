
## 2024-10-31 - Fix timing attack vulnerability in remote access token verification
**Vulnerability:** A simple string equality check (`===`) was used for verifying remote access tokens (`remoteToken`) in `src/desktop/remoteSecurity.js`, which is vulnerable to timing attacks. This could allow an attacker on the local network to guess the token character by character.
**Learning:** Comparing security tokens using standard string comparison operators exposes applications to timing attacks, as the comparison fails early on the first mismatching character, leaking information about the expected token length and content.
**Prevention:** Use `crypto.timingSafeEqual` for all security-sensitive string or buffer comparisons. Ensure both buffers have the exact same `byteLength` before calling the function, as it throws an error otherwise. Wrapping the process in a `try/catch` block provides an additional layer of safety.
