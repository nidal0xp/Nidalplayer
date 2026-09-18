# Project Instructions & Developer Guidelines

## Core Principles

### 1. Pre-Change Analysis & Comparison Requirement
- Before making any code changes, always write down and explain:
  1. What Currently Exists: The exact current behavior, existing code structures, and logic flow in the codebase.
  2. Comparison with Planned Changes: A clear side-by-side comparison explaining what will change, why it is changing, and how the new behavior will operate.

### 2. Preview & Fullscreen Two-Step OK Workflow
- No Automatic Stream Playback on Focus/Hover: Moving D-Pad focus or opening a page should NEVER automatically trigger video stream playback in the preview player.
- First OK / Click on Stream: Starts playing the video in the embedded preview box on that page with a confirmation toast ("Playing in preview. Press OK again for Fullscreen.").
- Second OK / Click on Same Stream: Transitions into Fullscreen playback.
- ESC / Back Button Hierarchy:
  - Level 1 (Fullscreen active): Closes fullscreen and returns to the 3-column list with the preview player still active.
  - Level 2 (Preview player active): Stops preview playback, frees resources/audio, and leaves focus in the list.
  - Level 3 (Preview idle): Navigates back to the Home dashboard / previous menu.

### 3. Google Android Studio Emulator Verification & Diagnostics Requirement
- Always run tests against the Google Android Studio emulator (via ADB `platform-tools\adb.exe`) to verify if any requested issue or fix is completely resolved in the live runtime environment.
- Steps to execute on every build:
  1. Verify connected emulator (`adb devices`).
  2. Deploy & install the freshly signed APK (`adb install -r dist/Nidalplayer-AndroidTV.apk`).
  3. Launch the application (`adb shell monkey -p com.nidalplayer.tv -c android.intent.category.LAUNCHER 1`).
  4. Perform navigation / D-Pad key injections (`adb shell input keyevent ...`).
  5. Inspect live logcat logs (`adb logcat -d`) for errors, uncaught exceptions, or media playback failures.
- Provide a clear conclusion summarizing:
  - Whether the fix succeeded or failed on the emulator.
  - If any failure occurs, provide a detailed root cause diagnosis and conclusion on what went wrong.
