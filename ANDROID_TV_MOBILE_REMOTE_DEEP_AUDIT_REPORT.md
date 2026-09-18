# Nidalplayer Android TV and Mobile Remote Deep-Dive Audit

**Audit date:** 26 August 2026  
**Audited release:** 4.0.0  
**Author:** Manus AI  
**Runtime target:** Google Android Studio emulator `emulator-5554`  
**Scope:** Android TV APK `com.nidalplayer.tv`, the companion mobile-remote web interface, its desktop/LAN relay, and the separate Android Mobile APK `com.nidalplayer.mobile`.

## 1. Executive conclusion

The Android TV application is currently in a substantially improved state for real remote use. The preserved TV playlist remained available, Live/Movies/Series navigation worked through the D-pad audit, native preview and fullscreen playback were exercised with a real stream, the preview remained visible after returning to the sidebar, and no application-specific fatal exception, ANR, or playback exception was found in the final log window. The recent keyboard and sidebar-preview fixes also held during the active-state checks.

The most important unresolved issue is architectural rather than visual: **the current Android TV APK does not participate in the companion mobile-remote relay**. The Android TV WebView exposes `window.AndroidBridge`, while the network poller is guarded by `if (!window.AndroidBridge && state.playlists.length > 0)`. The live emulator probe confirmed that the native bridge is present and the guard evaluates to false. Consequently, the mobile remote’s `/api/tv-state`, `/api/tv-actions`, and `/api/tv-playlists` path is not active in the Android TV APK. The existing remote server successfully controls the desktop host, and the relay code contains a Tizen-oriented path, but the audited TV APK is not registered as a controllable Android TV device.

The separate Android Mobile APK has a second high-priority issue. Its built manifest does not declare a modern target SDK. `aapt2` reports an effective `targetSdkVersion` below 4, which causes Android to infer legacy storage and phone permissions. On the emulator, first launch displayed a permission-review screen asking for **Storage** and **Phone** access even though the source manifest lists only network and wake-lock permissions. This creates unnecessary privacy friction and can block first-run startup.

The remote web interface is functionally broad, but it has several hardening and reliability weaknesses. The live relay API paired successfully and returned a 36-character token; the desktop snapshot contained 1,500 Live channels, 1,500 movies, 1,500 series, and 493/286/170 categories. However, unknown commands returned HTTP 200 with `ok: true`, LAN requests are accepted without a token when their source address matches the broad private-network test, and the remote renders provider-controlled strings through `innerHTML` without a consistent HTML-escaping layer. These should be addressed before treating the remote as a hardened product surface.

> **Overall assessment:** Android TV playback/navigation quality is good and the recent regressions are closed, but the Android TV-to-mobile-remote integration is incomplete. The highest-value next work is to unify the remote protocol across Desktop, Tizen, and Android TV, modernize the mobile manifest, and harden the relay API.

## 2. Severity summary

| ID | Finding | Severity | Status | Recommended priority |
|---|---|---:|---|---:|
| F-01 | Android TV APK skips the companion mobile-remote poller when `AndroidBridge` exists | Critical functional gap | Confirmed live | P0 |
| F-02 | Android Mobile APK has an effective legacy target SDK and triggers implied Storage/Phone permission review | High privacy/startup risk | Confirmed from built manifest and emulator | P0 |
| F-03 | LAN authorization accepts private-network requests without requiring the remote token | High security risk | Confirmed by source and localhost API behavior | P0 |
| F-04 | Unknown remote commands return success instead of a rejected-command error | Medium reliability/API contract defect | Confirmed live | P1 |
| F-05 | Remote catalogue is bounded to 1,500 items in state and 300 rendered rows, with no pagination | Medium functional limitation | Confirmed from source and live snapshot | P1 |
| F-06 | Remote UI inserts provider/item values into `innerHTML` without a uniform escaping layer | Medium security/data-integrity risk | Confirmed by source inspection | P1 |
| F-07 | Remote and TV relay use frequent polling rather than a versioned push channel | Medium efficiency/staleness risk | Confirmed by source | P1 |
| F-08 | Remote Series drawer first attempts a direct provider request from the phone browser | Medium reliability/privacy risk | Confirmed by source; relay fallback exists | P1 |
| F-09 | Core automated test command is configured, but `tests/core.test.mjs` is missing | Medium regression risk | Confirmed on Windows | P1 |
| F-10 | Live browser UI audit could not complete because the isolated Chrome DevTools session disconnected | Test infrastructure limitation | Confirmed during audit | P2 |

## 3. Test environment and artifact identity

The Android TV APK was audited on the connected Google Android Studio emulator. The existing TV data was preserved throughout the TV audit; no `pm clear` was run against `com.nidalplayer.tv`, and the stored playlist `zakaria` remained available. The separate mobile APK package was installed alongside the TV package and later uninstalled/reinstalled only to investigate its own first-run permission behavior; this did not clear or alter the TV package data.

| Artifact | Package | Version | SHA-256 |
|---|---|---:|---|
| Android TV APK | `com.nidalplayer.tv` | 4.0.0 | `2B82680A16B555648DAF0BF7953D5CE861935B4A921C935E4B2CCD71D9B50B96` |
| Android Mobile APK | `com.nidalplayer.mobile` | 4.0.0 | `ACD2173BD1DA1A6BC4C35A322123D355AD06400494E8F735411D8AFA9C5E3D26` |

The Windows desktop host was also launched for a live relay audit. Its remote server selected port **8765** because port 8766 was occupied by the existing local deterministic media mock. The live remote API therefore used `http://127.0.0.1:8765`.

## 4. Android TV startup, data preservation, and navigation

The TV package installed and launched as `MainActivity` with version 4.0.0. The preserved playlist probe reported one stored playlist named `zakaria`; the Live view contained 150 channels in the active TV state. The IME baseline was clean after launch: `mInputShown=false` and `mServedInputConnectionWrapper=null`.

The D-pad audit exercised Live, Movies, and Series views. The tested movements were deterministic and did not jump unpredictably between unrelated regions. In Live, RIGHT moved from a channel to the preview, DOWN moved to the fullscreen control, LEFT returned to the channel, and UP returned to the playlist pill. Movies and Series showed the same predictable column model; Series additionally exposed Season 1 and episode focus targets.

| TV view | D-pad path observed | Result |
|---|---|---|
| Live | Channel → RIGHT → preview → DOWN → fullscreen → LEFT → channel → UP → playlist | Pass |
| Movies | Movie → RIGHT → preview/play action → LEFT → movie → UP → playlist | Pass |
| Series | Series → RIGHT → season → DOWN → episode → LEFT → series → UP → playlist | Pass |

The current UI also retained the recent layout improvements. Previous active-state geometry evidence measured a collapsed sidebar of 76 px and an expanded sidebar of 230 px. The preview changed from approximately 310.85 px wide to 252.52 px wide, with no measured overlap into the adjacent list. The active remote-navigation timing probe recorded the first preview geometry change at approximately 59.7 ms and the expanded state settled at approximately 159.7 ms.

## 5. Keyboard and text-entry audit

The earlier password regression was reproduced and corrected before this deep audit. The final channel-OK regression test was especially important: after removing the unconditional native keyboard request from the `ENTER`/`DPAD_CENTER` branch, the first channel OK and the second OK/fullscreen action both left `mInputShown=false`. This confirms that pressing OK on channel cards and preview controls no longer opens the Android keyboard.

The retained text-input design is correct in principle: JavaScript requests text input only when the active element is a real input, while the native ENTER path dispatches the TV action without unconditionally requesting the IME. The audit did not find an application-specific keyboard error in the final TV log window.

## 6. Playback, preview, fullscreen, and return behavior

A real Live stream was selected and the native preview bridge was exercised. The native log recorded `playNativePreview`, H.264 decoder surface activity, and a transition into fullscreen through `expandNativePreviewToFullscreen: Expanding preview without reload`. The fullscreen OSD subsequently hid after inactivity, and the active window remained `MainActivity`.

The stream-to-sidebar flow was tested with the physical remote. Pressing OK on the active channel entered the native fullscreen path. In native fullscreen, LEFT/RIGHT are consumed by the fullscreen seek bar; they do not immediately navigate the WebView sidebar. The correct hierarchy is therefore **BACK** to leave native fullscreen, then LEFT into the content columns, then LEFT again into the expanded sidebar. After that sequence, the preview stayed visible and no new `playNativePreview` or `stopNativePreview` event appeared in the post-flow log window. The device screenshot `stream-sidebar-flow-final.png` shows the preview still rendered in the right panel with its metadata and actions contained.

This behavior is consistent with the project’s two-step workflow: the first action starts preview, the second enters fullscreen, and BACK returns from fullscreen without reloading the stream. The one UX improvement still recommended is to make the fullscreen hierarchy more explicit through a small on-screen hint or a dedicated “return to preview” affordance, because a user pressing LEFT while fullscreen will not reach the sidebar until BACK is used first.

## 7. Movies and Series audit

Movies loaded into the TV view and exposed a preview/play action. The cross-view probe selected a Live item, navigated to Movies, and confirmed that the Movies preview title updated while the previous Live title remained in the DOM state object. This is not a visible defect by itself, but it indicates that inactive preview DOM nodes are retained rather than fully cleared; a future cleanup pass could make state assertions and accessibility behavior less ambiguous.

Series loaded successfully with a selected show, a Season 1 chip, and 62 episode rows. Selecting the first episode produced a native series preview and a `playNativeEpisode` log entry with the episode URL, title, episode list, and start position. No playback exception or ANR was found in the tested log window. The earlier remote and TV work also established previous/next episode control paths; the present deep audit confirms that the Series episode list and fullscreen transition remain reachable after the recent layout and keyboard changes.

The main unresolved Series concern is scale and failure handling. The separate mobile player can fall back to probing series IDs 1 through 300 when the provider returns no series list, while the remote can request series episodes directly or fall back to the desktop relay. These broad fallback paths need cancellation, timeouts, and progress reporting to avoid long waits on providers that return incomplete data.

## 8. Mobile remote architecture and live API audit

The desktop host generated a persistent 36-character remote token and served the remote page on port 8765. Pairing returned `{ ok: true }`, the root page returned HTTP 200 with injected token state, and the authenticated state endpoint returned the active desktop snapshot. The live snapshot contained two desktop playlists, 1,500 channels, 1,500 movies, 1,500 series, and 493/286/170 Live/Movies/Series categories.

A reversible command round-trip was successful. The live remote sent `toggleMute` twice, received HTTP 200 both times, observed the muted state change to true and back to false, and restored the initial state. Missing playlist fields and malformed JSON were correctly rejected with HTTP 400.

However, the remote contract has an important defect: an unknown action type was accepted with HTTP 200 and `ok: true`. The desktop bridge initializes `ok = true` and only changes it on exceptions; an unrecognized action does nothing and still returns success. Clients cannot reliably distinguish “command executed” from “command ignored.”

The remote UI’s state synchronization is based on a 2-second browser poll. The Android TV/Tizen relay uses an 800 ms poll for actions, TV state, and phone playlist queues. This works for a small LAN deployment but can create stale state, unnecessary battery/network activity, and command races during playlist sync. A single versioned WebSocket or Server-Sent Events channel with explicit command acknowledgements would provide a cleaner protocol.

## 9. Android TV versus mobile-remote compatibility finding

The Android TV source contains a companion-server poller in `initTizenNetworkAndRemote()`. The poller posts snapshots to `/api/tv-state`, polls `/api/tv-actions`, and polls `/api/tv-playlists`, but its main body is guarded by:

```javascript
if (!window.AndroidBridge && state.playlists.length > 0) {
  // publish state and poll companion actions
}
```

The live Android TV probe found `window.AndroidBridge === true` and confirmed that the guard does not pass. The bridge exposed native methods such as `playNativePreview`, `playNativeEpisode`, `updatePreviewBounds`, and `updateRemoteState`, but the network companion poller was skipped. The relay queue audit also showed no Android TV device identity; the server’s active device model returns the desktop host, while the queued target path is explicitly Tizen-oriented.

This means the current mobile remote can control the desktop host and the Tizen relay path, but **not the Android TV APK through the tested companion mechanism**. The APK and remote are not yet a single end-to-end mobile-control product. The recommended fix is to add a secure Android TV device registration and keep the companion poller active for Android TV, or implement an Android-native authenticated WebSocket/HTTP bridge. The existing `AndroidBridge` should remain for playback operations, but it should not be used as the condition that disables network remote synchronization.

## 10. Mobile APK startup and permission audit

The separate Android Mobile APK built with the expected package and version, but its actual built manifest reports an effective target SDK below 4. Android therefore inferred legacy permissions including `WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`, and `READ_PHONE_STATE`. On first launch, the emulator displayed a system permission-review page titled “Choose what to allow Nidalplayer to access,” with Storage and Phone permissions visible. This occurred even though the source manifest explicitly lists only INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, and WAKE_LOCK.

The permission screen is a concrete startup and privacy problem. A modern mobile build should declare explicit `minSdkVersion` and `targetSdkVersion` values in the manifest or packager configuration, preferably targeting the project’s current Android baseline. It should remove any legacy storage/phone requirement and request only permissions that are genuinely needed. For playlist sync and HLS playback, phone-call access is not justified by the inspected source.

The separate mobile APK could not be taken through a clean first-run WebView audit on this emulator because the legacy permission-review activity remained in front of `MainActivity`. This is reported as a product/startup finding, not as a successful mobile playback test.

## 11. Remote security and data-integrity findings

The relay’s `authorized()` function accepts a request when either the token matches or the request source address passes a broad private-network test. The live localhost request with an invalid token was accepted because localhost is treated as trusted; this is expected from the current code but demonstrates the weakness of relying on network location as authentication. Any compromised or untrusted device on the same LAN could potentially request state, send commands, or submit a playlist. Token validation should be mandatory for all remote actions, with local bypass removed or made opt-in.

The remote state snapshot currently exposed the active provider server and username in the live test. The password field was not present in that active snapshot, which is positive. Nevertheless, the source contains a path that can derive `provider.pass` or `activeRec.pass`, and the remote Series drawer attempts to use `snapshot.password` for a direct provider request. Credentials should never be sent to the browser. Series episode data should be fetched only through the authenticated relay, and the snapshot should contain opaque IDs and display metadata rather than provider credentials.

The remote page constructs item rows, category buttons, playlist options, and metadata through template strings assigned to `innerHTML`. Provider-controlled names, groups, and playlist labels are not passed through a shared escaping function. This is a data-integrity and cross-site-scripting risk if a malicious or malformed playlist contains HTML-like content. Rendering should use `textContent` and DOM node creation for untrusted fields, or a rigorously tested escaping helper.

## 12. Catalogue scale and mobile UX limitations

The desktop remote publishes at most 1,500 records per content type, and the browser UI renders only the first 300 filtered records. The user can therefore see category counts larger than the actually navigable list. Search filters the already bounded snapshot rather than requesting more matching records from the player. The separate Android Mobile APK similarly limits several rendered lists to 100 records. These limits are understandable for performance, but they should be surfaced in the UI or replaced with pagination, incremental loading, and server-side search.

The mobile remote’s Series drawer first tries a direct provider request from the phone browser. That path is vulnerable to CORS, provider TLS, private-host reachability, and missing credentials. The fallback relay path is the more reliable architecture and should become the only path. A server-side episode request can also centralize provider errors, rate limiting, and credential protection.

## 13. Static checks and test infrastructure

The following syntax checks passed: Android TV `tv-app.js`, Android Mobile `mobile-app.js`, desktop `main.js`, desktop `src/app.js`, and the extracted JavaScript from the remote HTML. APK manifests were readable with `aapt2`, and the TV artifact reported target SDK 33 with the expected Leanback activity.

The configured `npm test` command did not execute a test suite because `tests/core.test.mjs` is absent from the project. The first invocation through `npm.ps1` was blocked by the Windows execution policy; the corrected `npm.cmd test` invocation then reported `Could not find 'tests/core.test.mjs'`. This is a real test-coverage gap, not a passing test result.

The live browser UI audit harness could not complete because isolated Chrome DevTools sessions on the attached Windows environment disconnected before the page could be driven. The remote API and source-level UI audit were completed, but the report does not claim a full touch-level browser execution for every remote button. A future CI runner should host the remote server and run Playwright or WebDriver with a stable browser profile.

## 14. Recommended improvement plan

| Priority | Work item | Acceptance criteria |
|---|---|---|
| P0 | Add Android TV device registration and authenticated remote synchronization | Mobile remote shows Android TV as an online target; Live/Movies/Series/playback commands round-trip through `/api/tv-state` and `/api/tv-actions` without disabling the path when `AndroidBridge` exists |
| P0 | Modernize the Android Mobile manifest/build metadata | `aapt2 dump badging` reports an explicit modern target SDK; first launch does not request Phone or legacy Storage access |
| P0 | Require remote token authentication for all LAN API requests | Invalid or missing token returns 401/410 even from a private-network address; QR/token rotation remains functional |
| P1 | Reject unknown commands | Unknown action returns HTTP 400 with a stable error code; every supported command has an explicit handler and acknowledgement |
| P1 | Remove credentials from remote snapshots and direct phone provider fetches | Snapshot contains no password; Series episodes always come through the authenticated relay |
| P1 | Add escaping and safe DOM rendering | Playlist/item/category values cannot inject HTML or event attributes into the remote UI |
| P1 | Replace catalogue slices with pagination and server-side search | Users can reach records beyond the first 300/1,500 without loading the entire catalogue into the browser |
| P1 | Introduce a versioned push/ack protocol | Remote shows command success/failure and receives state changes without 2-second polling races |
| P1 | Add cancellation/timeouts to provider sync and Series fallback probes | Switching playlist cancels stale requests; incomplete provider APIs do not trigger hundreds of uncontrolled probes |
| P2 | Restore automated test coverage | `tests/core.test.mjs` exists and covers normalization, watch progress, remote command validation, playlist switching, and series episode identity |
| P2 | Add stable browser automation for the mobile remote | CI verifies pairing, playlist loading, mode switches, Series drawer, watched/favorite filters, playback commands, and language changes |

## 15. Final status

The Android TV playback and D-pad experience passed the deep runtime checks performed on the Google emulator, including preserved playlist startup, view navigation, native preview, fullscreen, Series episode selection, sidebar return, keyboard suppression on channel OK, and application log cleanliness. The recent visual and keyboard fixes should be retained.

The audit found **two release-blocking integration issues**: the Android TV APK is not connected to the mobile-remote relay, and the separate Android Mobile APK is built with legacy permission behavior. It also found security and reliability improvements required for a production-grade remote: mandatory token authentication, safe rendering, explicit command rejection, credential isolation, and catalogue pagination.

No source changes were made during this audit. The report is diagnostic and evidence-based; the next implementation task should address the P0 findings first, then rerun the same emulator and remote test matrix.

## References

[1]: android-tv/assets/www/js/tv-app.js "Android TV WebView application and companion remote poller"
[2]: android-tv/src/com/nidalplayer/tv/MainActivity.java "Android TV native bridge and preview host"
[3]: android-mobile/AndroidManifest.xml "Android Mobile source manifest"
[4]: android-mobile/assets/www/js/mobile-app.js "Android Mobile player implementation"
[5]: remote/index.html "Mobile remote web interface"
[6]: main.js "Desktop host, LAN relay, pairing, API authorization, and action server"
[7]: src/app.js "Desktop remote state publication and action bridge"
[8]: dist/tv_remote_bridge_audit.json "Live Android TV remote-compatibility probe"
[9]: dist/remote_live_api_audit.json "Live remote pairing/state/catalogue audit"
[10]: dist/remote_validation_audit.json "Live remote validation and unknown-command audit"
[11]: dist/remote_reversible_command_audit.json "Live reversible mute command round-trip"
[12]: dist/tv_relay_audit.json "Live TV relay queue and device identity audit"
[13]: dist/test_dpad_views_results.json "Android TV D-pad view navigation evidence"
[14]: dist/stream-sidebar-flow-final.png "Android TV stream/sidebar continuity screenshot"
[15]: dist/mobile-audit-start2.png "Android Mobile first-run permission-review screenshot"
[16]: dist/deep_audit_static_results.json "Static checks, manifests, hashes, device, and log summary"
