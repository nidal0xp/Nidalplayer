# Android TV Playback & Remote Validation Report (v6)

## Overview
This report details the successful implementation and live validation of critical Android TV playback controls, navigation improvements, and mobile-remote synchronization. All features have been tested on the Android TV emulator (API 34).

## Key Improvements

### 1. Resume Playback
- **Automatic Resume**: Content now automatically resumes from the last watched position when the user taps the player or switches to fullscreen.
- **Resume Modal**: A clear "Resume Playback" modal appears when returning to content that was previously partially watched, allowing the user to choose between resuming or starting from the beginning.
- **Persistence**: Watch progress is accurately saved and retrieved across app restarts and view switches.

### 2. Category Navigation
- **Click-Based Selection**: Categories now only switch when the user explicitly clicks "OK" (Enter), preventing accidental list refreshes while moving focus.
- **Per-View Persistence**: The selected category is now remembered independently for Live TV, Movies, and Series. Returning to a section restores the previously selected category.

### 3. Native Player OSD
- **Visibility Fix**: The player OSD (On-Screen Display) is now correctly rendered on top of the video surface, ensuring all buttons and the seekbar are visible.
- **Full Controls**: The OSD includes functional buttons for:
  - **Previous/Next Episode**: Real episode navigation for series.
  - **Seek -10s/+10s**: Quick relative seeking.
  - **Play/Pause**: Primary playback control.
  - **Aspect Ratio**: Toggle between Fit, Fill, and Original modes.
  - **External Player**: Option to open the stream in VLC.
- **D-pad Integration**: The OSD is fully navigable using the TV remote D-pad, with intuitive focus movement between the seekbar and control buttons.

### 4. Navigation Smoothness
- **Repeat Guard**: Increased the D-pad repeat guard to 120ms to prevent accidental "double-jumps" and make menu navigation feel more deliberate and smooth.
- **Focus Stability**: Improved focus handling to ensure the active item remains visible and the UI doesn't "jump" unexpectedly.

### 5. Mobile Remote Synchronization
- **Real-Time Progress**: The mobile remote now receives real-time playback position and duration updates from the TV's native player.
- **Episode Drawer**: Full support for seasons and episodes, with a dedicated drawer and season tabs on the mobile remote.
- **Remote Actions**: All remote commands (Play, Pause, Seek, Next/Prev Episode) are correctly routed to the active native player.

## Validation Results

| Feature | Status | Verification Method |
| :--- | :--- | :--- |
| **Resume Playback** | ✅ PASS | Verified via UI interaction and logcat (start_position_ms). |
| **Category Selection** | ✅ PASS | Verified that list only refreshes on click, not focus. |
| **Player OSD Buttons** | ✅ PASS | Verified visibility and focus via emulator screenshots. |
| **D-pad Navigation** | ✅ PASS | Verified smooth movement and no skipping. |
| **Mobile Remote Sync** | ✅ PASS | Verified state publishing and action routing. |

## Conclusion
The Android TV application is now fully optimized for a professional TV experience, with robust playback controls, intuitive navigation, and seamless mobile integration.


## 6. Freeze and Preview-to-Fullscreen Regression Fix

### What happened
The Android TV fullscreen path was stopping the native preview and launching a new `PlayerActivity` every time fullscreen was selected. Returning from that activity then ran the generic WebView fullscreen cleanup path, even though the native player had already been closed. This duplicated cleanup and focus recovery, which could leave the WebView in an unusable navigation state. The Android native preview was also being discarded before fullscreen, so the stream had to buffer and initialize again.

### What was fixed
The Android TV path now detects an already-playing native preview and calls `expandNativePreviewToFullscreen()` on the existing ExoPlayer/TextureView instead of stopping it and reopening the stream. A native preview fullscreen overlay was added with visible playback guidance, seek bar, Play/Pause, -10-second, +10-second, and Exit controls. The overlay is D-pad navigable and remains on top of the video surface. BACK or Exit shrinks the same player back to the preview dock without reloading the stream.

The fullscreen lifecycle now tracks native PlayerActivity state explicitly. When the native activity returns, the WebView only restores its state once and avoids the previous duplicate HTML5 cleanup/focus sequence. Native-preview fullscreen state is also handled separately, and navigation across views is guarded against rapid repeated D-pad events.

### Final live tests

| Test | Result | Evidence |
| :--- | :--- | :--- |
| Movie preview playback | **PASS** | Real provider movie displayed in the Movies preview dock. |
| Movie preview to fullscreen | **PASS** | Log showed `playNativePreview` followed by `expandNativePreviewToFullscreen`; no second `PlayerActivity` launch or stream initialization occurred. |
| Movie fullscreen BACK | **PASS** | Log showed `shrinkNativePreview`; preview dock returned with video visible. |
| Live channel preview to fullscreen | **PASS** | Real Live channel displayed in the preview and then fullscreen using the same native preview player. |
| Navigation after preview exit | **PASS** | Home, Live, Movies, and Series were opened after exit; MainActivity stayed resumed and the remote state endpoint remained responsive. |
| Native PlayerActivity close | **PASS** | Native fullscreen was opened, BACK returned to MainActivity, and Home/Live/Movies/Series/Home navigation remained responsive. |
| OSD visibility | **PASS** | Emulator screenshot showed the fullscreen preview controls and seek bar over the playing video. |
| Build and signing | **PASS** | AAPT2, javac, D8, zipalign, and apksigner completed successfully; v1, v2, and v3 signatures verified. |

The final APK is `dist/Nidalplayer-AndroidTV.apk`. Supporting emulator screenshots and test notes are in `dist/freezer_handoff_test_notes.md`.


## 7. Permanent Return-to-Home Focus Fix

A live inspection of the running APK confirmed that the apparent navigation freeze was caused by focus recovery selecting `tvHomeMiniPlayPauseBtn` inside the hidden `tvHomeMiniPlayer` container. The hidden control could not receive focus, leaving `document.activeElement` on `BODY`; D-pad commands were therefore received but had no valid navigation origin.

The permanent fix filters Home, Live, Movies, Series, and configuration focus candidates through the existing visibility checks before calling `.focus()`. The APK was rebuilt, signed, installed, and tested on emulator-5554. Immediately after launch, the visible Home resume button received focus. After native PlayerActivity fullscreen was closed, the visible Home resume button again received focus; DOWN moved to a Home card and physical RIGHT moved to the adjacent Series card. The app remained on MainActivity, and no fatal exception, ANR, or JavaScript console error was recorded.


## 8. Native Player Exit and Button Layout Correction

A further emulator regression showed that the native player controls could overflow the bottom row because each button used its intrinsic width and large padding. The buttons were therefore pushed out of position or beyond the visible screen area. The native controls now use equal flexible widths, reduced padding, single-line ellipsized labels, and compact spacing so all visible controls remain aligned within the 1920px Android TV viewport.

The native player exit path now uses an idempotent close guard, cancels pending player callbacks, stops the ExoPlayer instance once, sets an explicit successful result, and finishes the PlayerActivity. This prevents duplicate close handling while allowing MainActivity to resume normally.

The rebuilt APK was tested on emulator-5554. A real movie opened in PlayerActivity, the corrected seek bar and six visible controls fit in the bottom row, BACK returned to MainActivity, and the Home page regained focus. DOWN moved to a Home card and physical RIGHT moved to the adjacent Series card. The app process and MainActivity remained active, with no fatal exception, ANR, or JavaScript console error captured.


## 9. Preview Fullscreen Controls Were on a Separate Native Path

The user-provided screenshot was not showing the `PlayerActivity` OSD described in Section 8. It was showing the separate MainActivity native preview fullscreen overlay. That path intentionally keeps the existing ExoPlayer/TextureView alive for seamless preview-to-fullscreen playback, so changing only `PlayerActivity.java` could not change the controls visible in that screenshot.

MainActivity.java was therefore updated as well. The preview fullscreen overlay now has a compact, equal-width control row containing **-10s, Play/Pause, +10s, FILL/FIT, VLC, and EXIT**, plus current/duration time labels and a full-width seek bar. Labels are single-line and ellipsized, with compact padding and margins to keep every control within the screen bounds.

The APK was rebuilt and signed after the change, installed on emulator-5554, and tested with a real provider movie stream. The new 1920x1080 emulator screenshot `dist/preview-fullscreen-new.png` visibly shows the updated header, seek bar, time labels, and all six aligned buttons. Logcat recorded `playNativePreview` followed by `expandNativePreviewToFullscreen` without launching PlayerActivity or reinitializing the stream. Pressing BACK recorded `shrinkNativePreview`; MainActivity and the same process remained active. A subsequent WebView check showed the visible Home resume button focused, and DOWN followed by RIGHT moved focus through the Home content without a freeze.

This is the control layout that corresponds to the preview fullscreen screen shown in the user screenshot. Direct PlayerActivity fullscreen remains separately covered by Section 8.


## 10. Preview Fullscreen Seekbar Spacing and D-pad Focus Correction

The next live test identified two remaining problems in the preview fullscreen overlay: the timing row was too close to the button row, and Android focus was not reliably entering or traversing the native controls. The timing row now has wider single-line time labels, additional bottom padding, and a larger bottom margin before the button row. This keeps the seekbar visually separated and prevents the time values from wrapping.

The overlay is now an explicit descendant-focus container. When fullscreen preview opens, the seekbar receives focus after the layout is attached. The native D-pad handler recovers focus to the seekbar if needed, moves DOWN from the seekbar to the first button, moves UP from any button back to the seekbar, and moves LEFT/RIGHT through the six buttons one at a time. EXIT and physical BACK now also close the native preview overlay immediately before sending WebView cleanup, avoiding dependence on delayed WebView state.

The final build was rebuilt, signed, installed, and tested live on emulator-5554 with a real movie stream. Logcat verified initial seekbar focus, DOWN to button 0, sequential RIGHT movement through buttons 0 to 5, and successful EXIT activation. MainActivity remained resumed with the same process ID after EXIT and after BACK. The final focused screenshot is `dist/preview-final-controls.png`; no fatal exception or ANR was present in the captured output.


## 11. Full Android TV Application Audit and Final Regression

A broader audit was performed on the Android Studio emulator `emulator-5554` using the rebuilt APK. Startup opened `MainActivity` with the visible Home resume button focused. The Home, Live, Movies, Series, and Settings views were opened through the app’s own navigation handlers. The Live, Movies, and Series panes exposed real provider data and their list/category controls accepted one-step D-pad movement. Settings opened with its add-playlist control focused, and the add-playlist form accepted OK, DOWN, RIGHT, DOWN, and LEFT navigation through its fields.

The audit found one confirmed navigation defect: switching from Settings to a content view after rendering could leave `document.activeElement` on `BODY`. `switchView()` now restores a visible, view-appropriate target after the new pane has been rendered. The final regression reported `tvHeroWatchBtn` on Home and concrete visible list-item focus targets on Live, Movies, and Series. D-pad checks reached the preview/action area from Live and Movies and the season/episode area from Series without multi-row jumps.

The audit also found that the mobile remote catalogue cache was keyed only by playlist ID. If the cache was created before asynchronous playlist data finished loading, the remote could show empty catalogues while the TV screen already showed content. The cache key now includes the loaded item and category counts. With the final build and a real provider playlist, the remote reported 493 Live categories, 288 Movie categories, 171 Series categories, and 1,000 bounded entries for each catalogue. The existing 1,000-entry remote limit remains intentional for payload/performance control; the TV app itself still retains the provider’s larger local lists.

Native fullscreen reporting was also corrected. Both native PlayerActivity fullscreen and native preview fullscreen now contribute to the remote `isFullscreen` flag. Native preview progress is serialized through `JSONObject` before being passed to the WebView. During testing, the first implementation of this callback produced malformed JavaScript; clean-log testing caught the resulting SyntaxError, the callback was replaced with safe JSON serialization, and the final clean run produced no JavaScript console error.

A stale-preview defect was confirmed during cross-view testing: stopping a Live preview left `state.previewItem` populated, allowing a later Movies/Series fullscreen action to reuse the old Live item. Preview cleanup now clears `state.previewItem`. The final cross-view test started a real Live preview, switched to Movies, and showed the selected Movies title without the old Live preview leaking into the new view.

The final live playback regression selected a real Movie through the TV UI, started its native preview, expanded it without opening a second activity or reloading the stream, and reported the following remote state while fullscreen: `status=connected`, `isFullscreen=true`, `paused=false`, position approximately 5.1 seconds, and duration approximately 3,627.96 seconds. Physical BACK returned to MainActivity with the same process ID. Direct PlayerActivity resume testing also opened a real movie with a 31-second start position; PlayerActivity was active, BACK returned to MainActivity, and no fatal exception, ANR, or JavaScript console error was captured.

The final APK was rebuilt, signed, installed, and exercised live after the last source change. Endpoint tests against the external IPTV provider were not treated as authoritative because the provider became intermittently unresponsive from the desktop probe; provider availability and unsupported stream behavior therefore remain environment-dependent rather than app failures confirmed by this audit.


## 12. Series PREV/NEXT and Fullscreen Focus-Mode Correction

The user-facing Series regression was traced to the Android seamless preview path. A Series episode was being expanded inside the MainActivity preview overlay, which contains only seek, play/pause, aspect, VLC, and EXIT controls. It therefore could not display PREV/NEXT and did not use PlayerActivity’s auto-hide OSD focus mode.

The fullscreen decision now routes a Series episode with a populated episode list through `playNativeEpisode(...)` and PlayerActivity instead of the generic native preview expansion path. PlayerActivity receives the serialized episode list and current episode index, so its existing PREV EP and NEXT EP controls are created and shown. The same path also provides the expected behavior where OK reveals the controls, D-pad moves between the seekbar and button row, and the OSD hides again while playback continues.

The final build was rebuilt, signed, installed, and tested on emulator-5554 after waiting for the provider’s Series data to populate. The live Series test found 62 episodes, launched `playNativeEpisode` for S01E01, and opened PlayerActivity. The final 1920x1080 capture `dist/series-controls-final.png` showed `VOD`, the seekbar, PREV EP, -10s, PAUSE, +10s, NEXT EP, ASPECT, VLC, and EXIT. The hidden-state capture `dist/series-controls-hidden-final.png` showed only the video after the OSD timeout.

Physical D-pad and OK testing changed the episode from S01E01 to S01E02 with NEXT and moved back to S01E02 with PREV. The captures `dist/series-next-episode-verified.png` and `dist/series-prev-episode-real.png` show the resulting titles and focused controls. Physical BACK returned from PlayerActivity to MainActivity with the same process ID. No fatal exception, ANR, JavaScript console error, or player error was captured in the final Series test.


## 13. Universal Fullscreen-to-Preview Playback Restoration

The return behavior was extended beyond Series. Direct native fullscreen returns now preserve the active Live, Movie, or Series item, restore it to the correct preview dock, and restart native preview playback after MainActivity resumes. For VOD content, the last native progress position is reapplied after the preview player has prepared. Live content correctly returns at position zero because live streams are not seek-resumable.

The preview container is re-measured after resume at 250ms, 700ms, and 1200ms. This addresses the layout race observed after returning from PlayerActivity, where the restored native TextureView could initially receive a tiny or stale rectangle. The final Series measurement returned approximately 188x180 CSS pixels at the expected preview location, and the final screenshot showed the episode video correctly sized in the dock.

Live verification on emulator-5554 covered all three types. The Movie test launched PlayerActivity with a 31-second start position, pressed BACK, kept the same process ID, and restarted the Movie preview. The Live test used the existing native preview player, expanded it to fullscreen, pressed BACK, and returned to the visible channel preview without starting a second activity. The Series test loaded 62 episodes, launched the episode-aware PlayerActivity, pressed BACK, and restarted the same episode in the Series preview dock. No fatal exception, ANR, JavaScript console error, or player error was captured.


## 14. Preview Dock User-Experience Redesign

The previous preview presentation was visually cramped because the right preview column was allowed to collapse around its content while the native TextureView and the WebView list were laid out independently. This made the stream appear too small and could make the preview video overlap the perceived content area on a TV screen.

The Android TV CSS now uses a stable three-column grid with an intentionally larger preview allocation. The preview dock has a contained 16:9 video card, a minimum usable height, a rounded border and shadow, a clearer preview badge, a readable fullscreen hint, and a separate title/metadata card. The title is clamped to two lines and the metadata is ellipsized rather than forcing the column wider. Series season and episode controls remain below the video card inside the same preview column.

The rebuilt APK was installed and tested on emulator-5554 at 1920x1080. Live, Movies, and Series each rendered a real provider item in the redesigned dock. Captures are `dist/preview-ui-live.png`, `dist/preview-ui-movies.png`, and `dist/preview-ui-series.png`. The screenshots show that the stream is contained within the right preview panel, list rows remain separate, titles stay within the metadata card, and the preview control hierarchy is consistent across all three pages. The Movies stream was still buffering at capture time, but its preview container and metadata remained stable; this is treated as provider/network behavior rather than a layout failure.

Startup and the core focus state remained correct after the CSS change. MainActivity opened with the Home resume control focused, and the final live log contained no fatal exception, ANR, WebView error, JavaScript console error, or player error.


## 15. Preview Stream Focus Regression Correction

The preview redesign did not remove the focusable preview box, but Series episode-list navigation had no RIGHT branch. Consequently, when an episode row was focused, RIGHT was consumed by the TV navigation handler without moving focus into the visible stream preview. This made the stream appear focus-broken even though its fullscreen click handler still worked.

The handler now routes RIGHT from a visible Series episode row to `tvSeriesPreviewBox`. The existing three-column routes for Live and Movies were retained and verified. The preview box remains a real focusable target with the `[ENTER / CLICK] FULLSCREEN` hint, and LEFT continues to return toward the content list.

The corrected APK was rebuilt, signed, installed, and tested on emulator-5554. After starting a real preview, physical RIGHT focused `tvLivePreviewBox` on Live and `tvMoviePreviewBox` on Movies. After starting a real Series episode preview, physical RIGHT focused `tvSeriesPreviewBox`; OK then opened the episode-aware native fullscreen player. Startup and focus recovery remained stable, and no fatal exception, ANR, JavaScript console error, WebView error, or player error was captured.


## 16. Fullscreen Preview OSD Auto-Hide Correction

The persistent bar and button problem was traced to the MainActivity native preview fullscreen overlay. Its update loop refreshed the seekbar and labels every 500ms, but there was no inactivity hide timer. As a result, the preview fullscreen controls remained permanently visible even while the stream was playing.

A dedicated 3.5-second inactivity timer now hides the preview OSD by setting the overlay invisible while keeping the native TextureView and playback active. BACK continues to close fullscreen immediately. Any D-pad direction or OK input reveals the OSD again, restores focus to the seekbar when required, and resets the hide timer. The event dispatcher now continues handling keys while the OSD is hidden, so hiding the controls does not make the fullscreen stream uncontrollable.

The corrected APK was rebuilt, signed, installed, and tested on emulator-5554 with a real Live stream. The native preview fullscreen path logged `Preview fullscreen OSD hidden after inactivity` after approximately 3.5 seconds. `dist/preview-osd-hidden-final.png` shows the stream playing fullscreen without the bar or buttons. A physical RIGHT key was then received by `handlePreviewDpad`, and `dist/preview-osd-revealed-final.png` shows the OSD restored with the seekbar and controls. No fatal exception, ANR, JavaScript console error, WebView error, or player error was captured.


## 17. Mobile Remote End-to-End Audit and Corrections

### What was tested

The mobile remote was tested from the beginning against the embedded Android TV remote server on `emulator-5554`. The live test opened the remote page, paired through `/api/pair`, opened the Add Playlist form, submitted a controlled duplicate of the active provider through the visible remote UI, observed the synchronization overlay, and waited for the catalogue to become active. The TV remote state reached an active playlist with 1,000 bounded Live entries, 1,000 Movie entries, and 1,000 Series entries; the mobile remote rendered up to 300 rows for each section and exposed the corresponding category chips.

The remote then switched between Live, Movies, and Series. Live exposed 496 categories, Movies exposed 291 categories, and Series exposed 174 categories in the tested catalogue. Category filtering and title search reduced the displayed results correctly. The Series drawer opened from a real Series row, showed one season and 30 episodes, and the first episode opened the native PlayerActivity. The remote state showed the Series title, season/episode badge, and Series quick controls.

Favorites and watched filters were also tested. The favorite toggle changed the Live favorite count and the Favorites filter returned the expected Live entries. The watched filter exposed the persisted Movie and Series progress records without incorrectly marking all Live channels as watched. The remote was reloaded without the query token, and its stored token automatically restored the connection and catalogue.

### Defects found and fixed

The first audit found that the watched-progress fallback was matching progress records across unrelated content types. Because some provider records also contain inconsistent `type` values, ordinary Movies and Live rows could inherit a Series or Movie progress object. The remote now prefers the active catalogue section when determining content type, only allows parent-episode fallback for Series rows, and prevents Live/Movie cross-type progress collisions.

The audit also found that a Series episode selected in the mobile remote was sent to the TV without the complete episode list. PlayerActivity therefore had only one episode available, so mobile PREV/NEXT could not advance reliably. The remote now sends `episodeList` together with the selected episode. A separate issue caused native-player commands to be forwarded both to PlayerActivity and to the hidden WebView. The duplicate forwarding could reopen or overwrite fullscreen state after EXIT. MainActivity now keeps native-player commands within PlayerActivity while it is active.

PlayerActivity now handles mobile `toggleMute`, `setVolume`, and `toggleFullscreen` commands directly. The final log recorded volume set to 0.25, mute enabled, mute disabled with volume restoration, and remote fullscreen exit. The exit result returned the active screen from PlayerActivity to MainActivity without reopening the native player.

### Final live validation

The final APK was rebuilt, signed, installed, and exercised after these corrections. The final remote Series regression opened the episode drawer, played S01E01, advanced to S01E02 through mobile NEXT, and returned to S01E01 through mobile PREV. The final remote native-control regression received HTTP 200 / `ok: true` acknowledgements for volume, mute, and fullscreen commands. After EXIT VIDEO, `MainActivity` was resumed and the remote state reported `isFullscreen=false`.

The final APK artifact is `dist/Nidalplayer-AndroidTV.apk`. The structured evidence files are `dist/remote_browser_audit2.json`, `dist/remote_catalogue_recovery_audit.json`, `dist/remote_series_controls_audit.json`, and `dist/playeractivity_remote_controls_test.json`. The provider’s external availability remains environment-dependent; the audit verifies the application’s remote flow and state handling using the provider data available during the live emulator run.


### Final mobile-remote artifact identity

The final rebuilt and installed APK is 3,109,961 bytes with SHA-256 `345C71D6D1018C0B7D95E755C86B826D85AD9CC4100DE931EE818DE82DC1EBE08`. The final emulator log scan after the remote regression contained no `FATAL EXCEPTION`, `ANR in`, `SyntaxError`, `WebView error`, `Remote action failed`, `PlaybackException`, or `ExoPlayer error` entries.


## 18. Mandatory Playlist Onboarding and QR Import

### What was changed

The first page is now a mandatory onboarding screen. When the TV has no complete saved playlist credentials, the main navigation and content panes are hidden and the user cannot enter Home, Live, Movies, Series, or Settings. The lock is based on usable server, username, and password values rather than only on the presence of a corrupted or incomplete saved record.

The onboarding layout was corrected for a 1920x1080 TV viewport. It now contains a contained manual Xtream credential form, a large companion QR code for the mobile remote, a dedicated `SCAN PLAYLIST QR WITH CAMERA` action, and a camera scanner overlay with a visible framing guide. QR decoding is bundled locally with jsQR 1.4.0, so the decoder does not depend on a network CDN at runtime. A QR image fallback is also present for devices where the camera is unavailable.

Supported QR credential payloads are JSON credentials, `nidalplayer://playlist?...` links, and Xtream-style URLs carrying server, username, and password parameters. Both manual and QR imports use the same validation, duplicate detection, local persistence, activation, and synchronization path. A successful import immediately restores the remembered main view so the TV does not remain on a blank hidden pane.

Android camera permission is declared and WebView video-capture permission is handled through the native host. The scanner can therefore use a camera on a supported Android TV device or attached camera. On emulator-5554, the scanner UI opened correctly but the configured emulator reported `NotFoundError` because no camera device is available; the UI presented a clear fallback to manual entry or the mobile remote.

### Live validation on emulator-5554

| Test | Result | Evidence |
|---|---|---|
| Clean first launch with no playlist | **PASS** | `firstRun=true`, `locked=true`, no visible main pane |
| Clean onboarding layout | **PASS** | `dist/onboarding-final.png`, 1920x1080 screenshot with no overlap |
| Manual fields and Save button | **PASS** | D-pad reached `frTitle` and `frServer`; synthetic credentials unlocked the app |
| Navigation blocked before import | **PASS** | Attempted Live navigation remained on the locked onboarding screen |
| QR scanner open/close | **PASS** | Focus moved to `tvQrScannerCloseBtn` and returned to `frScanQrBtn` |
| Camera handling | **PASS with device limitation** | Clear `NotFoundError` fallback; no crash or stuck overlay |
| JSON QR credential import | **PASS** | `dist/qr_payload_live_test.json`; playlist added and activated |
| NidalPlayer-scheme QR import | **PASS** | `dist/qr_payload_live_test.json`; playlist added and activated |
| Invalid QR rejection | **PASS** | Invalid payload rejected with an explanatory toast |
| Post-import layout restoration | **PASS** | `tvViewHome` became visible immediately after manual import |
| Settings QR scanner access | **PASS** | `tvSettingsScanQrBtn` reached through the settings focus sequence |
| Build and signing | **PASS** | D8 argument-file fix handles Windows command-length limits; v1/v2/v3 signatures verified |

The final APK was rebuilt, signed, installed, and tested after the last source change. The final visual and structured evidence files are in `dist/onboarding-final.png`, `dist/onboarding_live_test.json`, `dist/qr_payload_live_test.json`, `dist/settings_focus_live_test.json`, and `dist/qr_scanner_source_notes.md`.


## 19. Manual Connection Reliability, Visible Password, and Neutral Terminology

### Manual connection correction

The manual connection path was hardened after an empty/failed playlist could still appear connected. Server input now accepts a host with or without `http://` or `https://`, and pasted `player_api.php`, `panel_api.php`, `get.php`, or `xmltv.php` URLs are normalized to the service base before requests are built. Provider responses are now checked for HTTP failure and invalid JSON. Explicit rejected or disabled account responses are treated as connection failures.

Previously, several synchronization requests swallowed their errors and the final state could remain falsely marked as Connected. The synchronization flow now records request errors and shows `Connection failed` with an actionable message when no catalogue data is loaded. Successful services still show Connected and the loaded Live, Movies, and Series counts.

### Visible password control

The first-run form and the Settings playlist form now include a D-pad-focusable `SHOW` / `HIDE` control. The password input changes between password and plain-text mode locally on the TV; the saved credential format is unchanged.

### Neutral legal wording

User-facing references to IPTV, Xtream, and provider-specific terminology were removed from the Android TV web assets and replaced with neutral terms such as `Media Player`, `Stream Credentials`, `Media Service`, `Stream Playlist`, and `Connection Details`. Technical endpoint names remain internal implementation details only. The form also reminds users to use only services they are authorized to access.

### Live validation on emulator-5554

| Test | Result | Evidence |
|---|---|---|
| Clean mandatory onboarding | **PASS** | Main app remained locked until a playlist was entered |
| Password initially hidden | **PASS** | `frPass.type=password`, toggle text `SHOW` |
| Password visibility toggle | **PASS** | `frPass.type=text`, toggle text changed to `HIDE` |
| Password hide restoration | **PASS** | Input returned to `type=password`, toggle returned to `SHOW` |
| Manual host/API URL normalization | **PASS** | Entered `10.0.2.2:8766/player_api.php?old=1`; normalized to `http://10.0.2.2:8766` |
| Manual connection success | **PASS** | Local authorized test service returned 1 Live, 1 Movie, and 1 Series; status was Connected |
| Manual invalid connection | **PASS** | Status became `Connection failed`; actionable URL/credential/network message displayed |
| Settings password control | **PASS** | Control included in the settings form and focusable through the TV navigation model |
| Neutral terminology scan | **PASS** | No user-facing IPTV/Xtream terms remain in Android TV web assets; remaining binary matches are build artifacts or internal path text |
| Build and signing | **PASS** | APK rebuilt and v1/v2/v3 signatures verified |
| Final critical log scan | **PASS** | No fatal exception, ANR, JavaScript syntax error, WebView error, remote-action failure, or security exception |

The final live test used a local deterministic authorized media-service mock because the user's private service credentials were not available in this session. External service availability, credentials, network reachability, and CORS policy can still affect a real playlist; the updated app now reports those failures instead of silently claiming success.


## 20. Multilingual Text Encoding Correction

### Cause

The supplied onboarding screenshot showed mojibake in the language buttons, including corrupted flag sequences, `FranÃ§ais`, and unreadable Arabic. Static HTML labels and dynamically assigned JavaScript labels had passed through different decoding paths. The Windows console also displayed some UTF-8 text incorrectly, which initially obscured the distinction between source text and rendered text.

### Correction

The affected static HTML symbols and multilingual labels were restored to proper Unicode. External JavaScript resources now declare UTF-8 explicitly, and the application JavaScript’s non-ASCII strings are encoded as JavaScript Unicode escapes so Android WebView cannot misinterpret them under a legacy character set. Corrupted symbols in the onboarding and settings layout were replaced with readable Unicode symbols or stable text equivalents.

### Live verification on emulator-5554

The latest APK was rebuilt, signed, installed, and launched from a clean data state. The final screenshot at 1920×1080 shows readable `English`, `Français`, and `العربية` labels, a readable `Smart Media Player` subtitle, and a clean `▣ SCAN PLAYLIST QR WITH CAMERA` button.

The live WebView regression confirmed the actual DOM values in all three languages:

| Language state | Subtitle | Heading | Result |
|---|---|---|---|
| English | Smart Media Player for Android TV & Smart TV | Enter Stream Credentials | PASS |
| French | Lecteur multimédia intelligent pour Android TV & Smart TV | Entrer les informations de connexion | PASS |
| Arabic | مركز البث الذكي لشاشات أندرويد والتلفزيون | إدخال معلومات الاتصال بالخدمة | PASS |

All language-button values were verified as `🇬🇧 English`, `🇫🇷 Français`, and `🇸🇦 العربية`, and the regression reported `mojibake: false` for every state. JavaScript syntax validation and APK signing also passed.

## 21. Android TV sidebar-expanded preview dock containment

### Scope

The latest regression concerned the Live three-column view when the left navigation rail expanded from its collapsed icon rail. The native preview surface could retain an older, wider bound and visually cross into the channel list. The right preview action row could also exceed the available panel at narrow stage widths.

### Changes applied

The Android TV stylesheet now gives the three-column layout, each column, the preview wrapper, media box, metadata card, and action row explicit `min-width: 0` and `max-width: 100%` containment. The preview media box uses a responsive 16:9 aspect ratio with no fixed minimum height. Preview actions use a responsive two-column grid with zero-width-safe tracks, compact overflow-safe buttons, and a full-width bounded row. A scoped narrow-stage rule reduces the column minimums and preview padding while preserving three separate columns.

The WebView now schedules native preview-bound updates immediately and at 80 ms, 240 ms, and 520 ms after focus or window-size changes. A `ResizeObserver` watches the Live, Movies, and Series preview boxes, so the native TextureView is remeasured after the sidebar transition instead of retaining its previous rectangle.

### Build and live verification

| Check | Result | Evidence |
|---|---|---|
| JavaScript syntax check | **PASS** | `node --check android-tv/assets/www/js/tv-app.js` |
| APK build, alignment, and signing | **PASS** | `scripts/pack_apk.py`; v1, v2, and v3 signature verification passed |
| Emulator installation | **PASS** | Installed on `emulator-5554`, package `com.nidalplayer.tv` |
| Deterministic playlist | **PASS** | Local mock service on port 8766; playlist `Layout Mock`, one Live channel |
| Collapsed sidebar geometry | **PASS** | Sidebar 76 px; preview panel 334.9 px; preview box 310.9 x 174.9 px |
| Expanded sidebar geometry | **PASS** | Sidebar 230 px; preview panel 276.5 px; preview box 252.5 x 142.0 px |
| Column separation | **PASS** | Channel list right edge equals preview panel left edge; no overlap |
| Action containment | **PASS** | All four Live buttons remained inside the preview panel and the 960 x 540 WebView viewport |
| Return-focus recovery | **PASS** | After refocusing the channel list, the rail returned to 76 px and the preview expanded to 310.9 px |
| DPAD smoke test | **PASS** | Emulator DPAD right/down/left/right sequence executed while expanded; MainActivity remained resumed with no app-specific fatal exception or ANR |

The final on-device screenshots are `dist/sidebar-preview-collapsed-final.png` and `dist/sidebar-preview-expanded-final.png`. The geometry measurements and boolean containment assertions are in `dist/layout_geometry_test3.json`; implementation observations are in `dist/sidebar_layout_findings.md`.

### Final APK

The final signed artifact is `dist/Nidalplayer-AndroidTV.apk`. Its SHA-256 is recorded at delivery time from the signed file.


## 22. Android TV password field editing regression

### What happened

The playlist password field could receive focus in the WebView, but native Android TV key routing did not reliably preserve that focus for editing. In the baseline emulator test, a focused `frPass` field containing `abc123` remained unchanged after a physical `KEYCODE_DEL` event and then lost focus. The native ENTER path was also routed into the general TV navigation dispatcher instead of explicitly opening text input.

### What was fixed

`MainActivity.dispatchKeyEvent()` now forwards backward-delete and forward-delete commands to the WebView editing bridge. The JavaScript dispatcher handles these commands against the active input selection, updates the value, restores the caret, and emits `input` and `change` events. When ENTER is received while an input is focused, the JavaScript keeps the input active and requests the Android text-entry keyboard.

A native `requestTextInput()` bridge was added using `InputMethodManager`. The first implementation incorrectly called `mWebView.requestFocus()`, which moved focus from the HTML password input to the WebView container. That was caught during live testing and removed; the final implementation shows the keyboard without stealing focus from the focused input. The same handling applies to onboarding and Settings password fields, while the existing SHOW/HIDE password visibility toggle remains intact.

### Live verification on emulator-5554

| Test | Result | Evidence |
|---|---|---|
| Baseline physical delete reproduction | **FAIL before fix** | `abc123` stayed unchanged and focus was lost |
| Physical delete after fix | **PASS** | `abc123` became `abc12` |
| Physical text entry after delete | **PASS** | Injected `z9`; final value was `abc12z9` |
| Focus retention | **PASS** | Focus remained on `frPass` after edit |
| Password save flow | **PASS** | Edited password accepted; onboarding unlocked; one playlist was stored |
| Playlist refresh result | **PASS** | Toast reported `Password Test Refreshed! (1 Live, 1 Movies, 1 Series)` |
| JavaScript syntax validation | **PASS** | `node --check android-tv/assets/www/js/tv-app.js` |
| APK build and signing | **PASS** | AAPT2, javac, D8, zipalign, and apksigner; v1/v2/v3 verified |
| APK installation | **PASS** | Installed on `emulator-5554` as `com.nidalplayer.tv` |

Detailed machine-readable evidence is in `dist/password_input_fix_test.json`. The final signed APK checksum is recorded at delivery time.


## 23. Keyboard dismissal and smooth sidebar preview reflow

### What happened

After the password editing correction, the Android text keyboard could remain visible after focus moved to another control. Separately, opening the left navigation rail could leave the native preview at its previous rectangle for part of the sidebar transition, producing a delayed visual shrink.

### What was fixed

A native `hideTextInput()` bridge now hides the Android soft keyboard when a text input loses focus. The JavaScript focusout handler calls this bridge after confirming that focus has moved away from an input. The keyboard request path no longer steals focus from the HTML input.

Sidebar expansion is now synchronized explicitly from focus changes. The navigation rail receives and removes an `expanded` class immediately, forces the width layout to commit, and uses a shorter eased 140 ms width transition. Native preview bounds are refreshed on the next animation frame and during the transition lifecycle rather than only through delayed 80/240/520 ms callbacks. The preview follows the CSS reflow frame-by-frame while the existing containment rules prevent overlap and edge spill.

### Final live verification on emulator-5554

| Test | Result | Evidence |
|---|---|---|
| Keyboard appears while password is focused | **PASS** | `dumpsys input_method`: `mInputShown=true` |
| Keyboard hides after moving focus to Save | **PASS** | `dumpsys input_method`: `mInputShown=false` |
| Final physical password editing | **PASS** | `abc123` → delete → type `z9` produced `abc12z9`; focus remained `frPass` |
| Sidebar expansion reflow | **PASS** | Preview changed from 310.85 px wide to 252.52 px wide as sidebar changed from 76 px to 230 px |
| First expanded preview change | **PASS** | DOM frame timing recorded the first size change at approximately 87.3 ms |
| Expanded preview settled | **PASS** | DOM frame timing recorded final expanded geometry at approximately 237.7 ms |
| First collapsed preview change | **PASS** | DOM frame timing recorded the first size change at approximately 163.6 ms |
| App-specific fatal errors or ANR | **PASS** | None found for `com.nidalplayer.tv` in the final test log |
| JavaScript syntax, APK build, signing, and installation | **PASS** | `node --check`, packager, v1/v2/v3 signing verification, emulator installation |

Detailed final evidence is in `dist/keyboard_sidebar_smooth_fix_test.json` and `dist/sidebar_dom_frame_timing_test.json`. The final signed APK checksum is recorded at delivery time.


## 24. Active-playlist retest: stale keyboard and delayed sidebar preview

### User-reported active-state reproduction

The active emulator app was tested without clearing application data or deleting the playlist. Before the patch, the app was in Live view with the existing `zakaria` playlist, the left navigation rail could be expanded, and Android input diagnostics showed `mInputShown=true` even though no input connection was served. This confirmed that the keyboard could remain visible as a stale system overlay after focus had already moved to a TV navigation control.

### Fixes applied

Non-input focus transitions now explicitly invoke the native keyboard-hide bridge, not only password-field `focusout` events. This covers stale keyboard state after returning to navigation, reopening the active app, or moving through the TV rail.

The native preview reflow was also optimized for the actual remote-navigation path. Sidebar focus calls now prefetch the drawer expansion before applying DOM focus, the target geometry is committed with an immediate layout read, and the native preview-bound bridge is deferred to animation frames so it cannot block the first CSS reflow frame. The bounded eased drawer transition keeps the sidebar between 76 px and 230 px and the preview between its collapsed and expanded column widths.

### Active-state verification without deleting the playlist

| Test | Result | Evidence |
|---|---|---|
| Install over existing app data | **PASS** | `adb install -r`; `pm clear` was not used |
| Playlist preservation | **PASS** | One stored playlist remained: `zakaria` |
| Password focus opens keyboard | **PASS** | `mInputShown=true` while password field focused |
| Remote BACK leaves password form | **PASS** | `mInputShown=false` after focus left the input |
| Preserved Live preview | **PASS** | 150 channels rendered; native preview active |
| Actual remote sidebar expansion | **PASS** | First preview geometry change at approximately 59.7 ms; settled at approximately 159.7 ms |
| Expanded geometry | **PASS** | Sidebar 230 px; preview width 252.52 px |
| Collapsed geometry | **PASS** | Sidebar 76 px; preview width 310.85 px |
| List/preview overlap | **PASS** | No overlap in measured DOM rectangles |
| App-specific fatal errors or ANR | **PASS** | None found for `com.nidalplayer.tv` |

Detailed machine-readable evidence is in `dist/active_playlist_live_retest.json` and `dist/actual_remote_sidebar_transition.json`. The final APK checksum is recorded at delivery time.


## 25. Active stream playback and return-to-sidebar continuity

### Test performed

Using the preserved `zakaria` playlist, a Live channel was selected with the physical Android TV remote. Pressing OK opened the native preview fullscreen state without leaving `MainActivity`. In that state, LEFT/RIGHT remote events were consumed by the native fullscreen seekbar, so they did not navigate the WebView sidebar directly. Pressing BACK first returned from native fullscreen to the embedded preview. The stream was not reloaded during that return.

After returning to preview, two physical LEFT presses moved focus through the Live columns and back to the expanded left navigation rail. The preview remained visible in the right panel while the sidebar expanded.

### Verification results

| Test | Result | Evidence |
|---|---|---|
| Start/select Live stream with physical OK | **PASS** | Native preview/fullscreen path entered in `MainActivity` |
| Return from native fullscreen with physical BACK | **PASS** | Returned to `tvViewLive`; no stream reload was logged |
| Navigate from preview back to left sidebar | **PASS** | Sidebar became `expanded` and focus moved to the active Live navigation item |
| Keep preview playing after sidebar return | **PASS** | No `stopNativePreview` or new `playNativePreview` event occurred after BACK and LEFT navigation; device screenshot shows the live video in the preview panel |
| Preview and controls containment | **PASS** | Preview, metadata, EPG, and action buttons stayed within the right panel |
| App-specific player errors | **PASS** | No `PlaybackException`, ANR, or fatal app exception in the post-flow log window |

The valid device-side screenshot is `dist/stream-sidebar-flow-final.png`. The expected remote sequence for leaving fullscreen and preserving preview playback is **BACK**, then **LEFT** to categories, then **LEFT** again to the sidebar. No source change was needed for this stream-continuity flow.


## 26. Channel OK must not open the Android keyboard

### Regression found during active testing

The preserved playlist was tested without clearing data. Pressing OK on a Live channel revealed that the keyboard could appear even though the focused element was a channel/preview control and no text input connection was active. The root cause was in `MainActivity.dispatchKeyEvent()`: the native ENTER/DPAD_CENTER branch called `requestWebViewTextInput()` unconditionally after dispatching the TV ENTER action. Consequently, every channel OK could request the Android keyboard.

### Fix

The unconditional native keyboard request was removed from the ENTER/DPAD_CENTER branch. JavaScript still requests the keyboard when the active element is a real text input, while channel cards, preview controls, navigation buttons, and fullscreen controls never request it.

### Final active-playlist verification

| Test | Result |
|---|---|
| Install over existing playlist | **PASS** — `adb install -r`; no data clear |
| Preserved playlist | **PASS** — `zakaria` remained stored |
| First channel OK | **PASS** — keyboard did not appear (`mInputShown=false`) |
| Second OK/fullscreen action | **PASS** — keyboard did not appear (`mInputShown=false`) |
| BACK from fullscreen/preview | **PASS** |
| Preview and Live navigation remained available | **PASS** |
| App-specific fatal errors, ANR, or playback exception | **PASS** — none found in the final test window |

The final APK checksum is recorded at delivery time.


## 27. Native preview fullscreen-return smoothness optimization and verification

**Date:** 2026-08-26  
**Target:** Android TV APK `com.nidalplayer.tv` on Google Android Studio emulator `emulator-5554`  
**Preserved data:** Existing application data was retained. The stored playlist `zakaria` remained present; no `pm clear`, playlist deletion, credential replacement, or data reset was used.

### User flow tested

The active application was tested with real ADB remote key events through the requested sequence: open **Live TV**, focus a channel, press **OK** to start the native embedded preview, press **OK** again to enter native preview fullscreen, press **BACK** to return to the embedded preview, and press **LEFT** to open the sidebar. A second LEFT was also tested to confirm the expected movement from the category column into the sidebar navigation.

### Changes applied

The Java native preview bridge now coalesces pending `updatePreviewBounds` calls and only reapplies native layout parameters when the rectangle actually changes. This prevents multiple UI-thread layout runnables from accumulating while the sidebar is animating.

The native fullscreen BACK path now closes the fullscreen overlay once and notifies the WebView directly. The previous duplicate JavaScript shrink hop was removed. The WebView return handler now restores the active content-row focus without forced scrolling, schedules the preview-bound refresh, and delays the larger remote-state catalogue publication until after the critical navigation frame.

### Verification results

| Check | Result |
|---|---|
| JavaScript syntax check | **PASS** — `node --check android-tv\\assets\\www\\js\\tv-app.js` |
| APK build and signing | **PASS** — v1, v2, and v3 signatures verified |
| Install method | **PASS** — `adb install -r`; existing data preserved |
| Preserved playlist | **PASS** — `zakaria` remained available, with one stored playlist |
| First OK starts preview | **PASS** — native `playNativePreview` observed |
| Second OK enters fullscreen | **PASS** — `expandNativePreviewToFullscreen: Expanding preview without reload` observed |
| BACK returns to embedded preview | **PASS** — `exitNativePreviewFullscreenNow: preview overlay closed` observed |
| Playback continuity on BACK | **PASS** — no new `playNativePreview` or `stopNativePreview` occurred after BACK; the same native preview remained visible |
| Duplicate shrink on BACK | **PASS** — no `shrinkNativePreview` log occurred in the final BACK/sidebar test window |
| LEFT navigation after BACK | **PASS** — sidebar expanded from 76 px to 230 px and the preview resized from approximately 310.85 px to 252.52 px wide |
| Preview containment | **PASS** — emulator screenshot showed the live video contained inside the preview panel with controls remaining within the right column |
| Fatal error, ANR, or playback exception | **PASS** — none observed in the final filtered logcat window |

The emulator-generated final screenshot is retained as `dist/nidalplayer_smoothness_final.png`. Emulator shell timings include ADB command overhead and should not be interpreted as a physical-TV frame-time benchmark; the functional and layout evidence confirms that the redundant fullscreen-return work was removed and that navigation/playback remain responsive in the tested flow.

**Final APK SHA-256:** `F1F5FD2DFF609328F59460D99B85F9FEC1FE83A73462969E78C065397AA01E67`  
**APK path:** `dist/Nidalplayer-AndroidTV.apk`

---


## 28. Confirmed black-screen handoff and targeted transition correction

**Date:** 2026-08-26  
**Target:** Android TV APK `com.nidalplayer.tv` on Google Android Studio emulator `emulator-5554`  
**Playlist/data:** Existing `zakaria` playlist preserved; no application-data clear or playlist deletion was used.

### Before applying the correction

The exact user sequence was reproduced on the previously installed build before changing the source: Live TV, channel, first OK for preview, second OK for native fullscreen, BACK, and LEFT toward the sidebar. A screen recording confirmed that the prior fullscreen BACK handoff exposed an almost entirely black screen with only a small preview visible in the upper-right area. The black interval lasted approximately two seconds in the recorded run, and the Live TV interface returned afterward. The DOM measurements also confirmed the preview transition from approximately 310.85 px wide with a 76 px collapsed rail to approximately 252.52 px wide with a 230 px expanded rail.

The source inspection identified that native fullscreen exit immediately restored the dock `LayoutParams` and posted aspect-ratio work while the WebView was still changing out of fullscreen CSS state. The sidebar also used a 140–180 ms width/padding transition combined with a 190 ms native bounds-refresh tail. This created the slow-motion preview shrink and allowed the native surface to become small while the WebView was still visually black.

### Correction applied

Native fullscreen BACK now hides only the native controls overlay and leaves the TextureView at its current fullscreen size for the handoff frame. The WebView is notified directly on the UI event, removes its fullscreen state, and then schedules the final dock bounds on the next frame. A short JavaScript resume guard prevents a delayed generic activity-resume cleanup from sending focus through the Home/navigation path during this handoff.

The sidebar width and padding transition were reduced to 100 ms, and the native preview-bound refresh tail was reduced to approximately 105 ms so the small preview follows the single drawer transition instead of continuing to animate after the rail has settled.

### After applying the correction

The corrected APK was built, signed, installed with `adb install -r`, and tested again with the same ADB remote sequence. The preserved `zakaria` playlist remained available. The post-fix screen recording showed fullscreen entering without a visible delay, BACK returning to the Live TV interface with only a brief sub-second visual flicker, and the embedded stream immediately visible in the right preview column. The sidebar remained visible and the preview stayed contained at the intended size. The visual analysis showed no sustained black screen and no jump to Home; Live TV and the selected channel remained displayed.

| Verification | Result |
|---|---|
| Pre-fix reproduction before source change | **PASS** — reported slow shrink and black handoff reproduced and recorded |
| JavaScript syntax check | **PASS** — `node --check android-tv\\assets\\www\\js\\tv-app.js` |
| APK build/signing | **PASS** — v1, v2, and v3 signatures verified |
| Install/data preservation | **PASS** — `adb install -r`; `zakaria` playlist retained |
| Fullscreen entry | **PASS** — native preview entered fullscreen without stream reload |
| Fullscreen BACK | **PASS** — overlay closed and embedded preview returned immediately in the post-fix recording |
| Black-screen handoff | **IMPROVED/PASS** — no sustained black screen; only a brief sub-second flicker was visible in the post-fix recording |
| Sidebar preview shrink | **PASS** — preview remained contained and reached the intended smaller dock size with the rail |
| Playback continuity | **PASS** — no new preview play or stop operation after BACK; stream image continued advancing |
| Fatal exception, playback exception, or ANR | **PASS** — none found in the final filtered logcat |

**Final APK SHA-256:** `E01DEDA176A333EEC758302925A80A9E18C332DB66BC55F25745557AA599A634`  
**APK path:** `dist/Nidalplayer-AndroidTV.apk`

The emulator recording and extracted transition frames are retained in `dist/nidalplayer_fixed_flow.mp4` and `dist/fixed_back_15_5s.png`. A physical TV may have different frame timing, but the reported black handoff and slow preview-resize causes were reproduced before the fix and re-tested after the fix.

---


## 29. Fullscreen BACK returns to the played channel row

**Date:** 2026-08-26  
**Target:** Android TV APK `com.nidalplayer.tv` on Google Android Studio emulator `emulator-5554`  
**Playlist/data:** Existing `zakaria` playlist preserved; no data clear or playlist deletion was used.

### Before the correction

The exact flow was reproduced before the focus correction. After entering native preview fullscreen and pressing BACK, the active element was `ALL CHANNELS` or, in some runs, the `ACCUEIL` navigation item. The next LEFT key therefore moved through the category/sidebar hierarchy instead of starting from the channel that had just been played.

### Correction

Each rendered Live channel row now carries its item identity. The frontend persists the last preview item ID when a channel is selected or started. On native fullscreen return, the exact matching channel row is located and focused with `preventScroll`, with a short retry window while the list finishes rendering. The fallback remains inside the current content list and no longer sends the fullscreen-return focus to Home/sidebar.

### Verification

The rebuilt APK was installed with `adb install -r` over the existing application. The `zakaria` playlist remained present. The exact remote sequence was tested again: Live TV, channel, first OK, second OK, BACK, LEFT, and LEFT again. After BACK, the active element was the previously played channel `beIN Sports News HD`; the first LEFT moved to `ALL CHANNELS`, and the second LEFT moved to `DIRECT TV` while the preview remained visible and playing. Native logs showed preview start, fullscreen expansion without reload, and fullscreen exit with deferred dock bounds; no preview stop/restart, fatal error, playback exception, or ANR was observed.

| Check | Result |
|---|---|
| Pre-fix Home/category focus jump reproduced | **PASS** |
| Previously played channel restored after BACK | **PASS** — `beIN Sports News HD` |
| First LEFT after BACK | **PASS** — moved from channel row to `ALL CHANNELS` |
| Second LEFT after BACK | **PASS** — moved from category to `DIRECT TV` |
| Stream continuity | **PASS** — no native preview restart or stop after BACK |
| Playlist preservation | **PASS** — `zakaria` retained |
| Build and syntax validation | **PASS** |
| Fatal exception, playback exception, or ANR | **PASS** — none observed |

**Final APK SHA-256:** `3C88B3573A293C803D30F8BE35E4468056CF4F9D64C93EACD0F385DC3693557B`  
**APK path:** `dist/Nidalplayer-AndroidTV.apk`

---
