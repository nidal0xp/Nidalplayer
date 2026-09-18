# Mobile Remote Playlist Import Fix

## Problem

Adding an Xtream playlist from the mobile remote was not reliably reaching or activating the Windows Electron application and Android TV APK. The Android mobile APK is a standalone player/client and does not host the mobile remote HTTP server; the remote is hosted by the Windows application or Android TV application.

## Implemented fixes

| Target | Changes |
|---|---|
| Windows Electron | Added the missing `/api/send-playlist` POST route, validated the JSON payload, returned meaningful HTTP errors, queued imports while the renderer loads, exposed the IPC event through `preload.js`, normalized provider URLs, securely saved credentials, reused duplicate playlists, activated the imported playlist, and started synchronization. |
| Android TV APK | Hardened `window.importPlaylistFromPhone`, normalized pasted `player_api.php`/`panel_api.php` URLs, reused duplicate accounts, cleared stale catalogues before switching, refreshed the playlist settings view, and made category/stream parsing accept both JSON arrays and object-style provider responses. |
| Android TV remote | The playlist submission now checks the HTTP response and displays the provider/application error instead of silently reporting success. |
| Android mobile APK | Improved its direct playlist-add flow with URL normalization, stale-catalogue clearing, and support for provider responses returned as objects rather than arrays. |
| Remote UI | The Windows remote checks the server response before closing the form and keeps its switching/loading state until the new playlist becomes active. |

## Accepted input

The server field may contain either a provider base URL, such as `http://example.com:8080`, or a pasted `player_api.php`/`panel_api.php` URL. The application strips the API filename and keeps the provider base URL before constructing API requests.

## Validation

The modified JavaScript files passed Node syntax checks. The Windows portable executable was rebuilt successfully, and both Android APKs were rebuilt and signed successfully with v1, v2, and v3 APK signatures.

The Windows endpoint smoke test returned HTTP `202` with an accepted/synchronization-started response for valid JSON. The Android emulator was intermittently reported as connected but failed streamed APK installation with `connect error for write: closed`, so the final Android installation test could not be completed in this session. The APKs themselves compiled and signed successfully.

## Remote connectivity correction

Removing the mobile-remote item caps caused the `/api/state` polling response to grow to approximately **38 MB** for a large catalogue. A phone browser could then remain on the connecting screen or time out while parsing repeated state responses. The Windows remote snapshot now uses a bounded 1,500-item window per content type, while the full catalogue remains available inside the desktop application. The remote pages also show an explicit synchronization message while the catalogue is empty and automatically switch from Live to Movies or Series when the active playlist has no live channels. The rebuilt Windows server was verified locally over both `127.0.0.1` and the LAN address, returning HTTP 200 for the remote page and authorized state endpoint. Final state validation returned an active playlist, 2 playlists, 1,500 channels, 1,500 movies, and 79 series entries in a 688 KB response.

## Important usage note

The Android mobile APK does not currently host the mobile remote server. To send a playlist from a phone into an application, open the QR/mobile remote provided by the **Windows Electron app** or the **Android TV APK**, then submit the playlist there. To add a playlist directly inside the Android mobile player, use its own Settings form.
