# Internal player UI

The React Native player follows Anikku's internal player layout, using the
existing Expo Video player and Android torrent stream.

Reference: [Anikku player controls](https://github.com/komikku-app/anikku/tree/49eadfcc28088fbad17a4f194d40bf997955796b/app/src/main/java/eu/kanade/tachiyomi/ui/player/controls).
The upstream controls credit Abdallah Mehiz / mpvKt and carry Apache-2.0
license headers. This project recreates the layout in React Native; it does
not import the Kotlin player or bundle mpv.

## Controls

The timings and default behaviors below are configurable in
[Playback and torrent preferences](playback-settings.md).

- The player opens in landscape and fills the screen. Rotation switches
  between landscape and portrait. Returning to the app restores portrait
  orientation and system bars.
- The top row contains the anime title, italic file title, autoplay switch,
  subtitle selection, audio selection, and settings.
- The center contains previous file, play/pause, and next file. Previous and
  next follow the video file order returned by the torrent module.
- The bottom contains control locking, rotation, playback speed, an 85-second
  skip button, picture in picture on supported devices, and video sizing.
- Tap speed to cycle through 0.25x increments up to 2x. Hold it, or use
  settings, to select a speed from 0.25x to 3x.
- The seek bar supports dragging and accessibility increment/decrement actions.
  It shows elapsed time, buffered progress, and duration. Tap the duration to
  show remaining time.
- Double tap the left/right third to seek backward/forward 10 seconds. Double
  tap the center to play/pause. Swipe horizontally to preview a seek and release
  to commit; swipe vertically to adjust the player's volume.
- Controls fade after four seconds of playback. Open sheets and active seeks
  keep controls visible. Locking leaves only the unlock button available.
- Audio, subtitle, speed, and file choices appear in rounded, scrollable sheets.
  Android Back dismisses a sheet before leaving the player.
- Autoplay starts the next video in the same torrent when the current video ends.
  It defaults to off, matching Anikku's default.

## Engine differences

Audio and subtitle choices are limited to tracks exposed by Expo Video.
Anikku's mpv decoder settings, full libass typography, audio/subtitle timing offsets,
chapter metadata, casting, and brightness gestures are not implemented.
The 85-second button performs a fixed seek; it does not detect openings.
Quality selection is omitted because this screen streams a selected torrent
file rather than a source providing alternative quality URLs.

## Android first-frame recovery

Some Android 16 devices can start the audio and subtitle renderers while the
Media3 video codec loses its texture surface during the first layout. This is
the upstream `queueBuffer failed: -32` first-frame race reported for Expo Video
and Media3. The player now creates a fresh `VideoView` surface for each torrent
file and waits for two UI frames after the source is attached before starting
playback. This keeps the control overlay while reducing the intermittent black
video/audio-only state. It does not change the source codec or repair a video
whose codec is unsupported by the device.

## Subtitle rendering

The Android Expo Video 57.0.5 subtitle patch in `patches/` restores embedded
styles and font sizes that upstream disables. Supported source colors, emphasis,
size, and positioning are retained. Unstyled cues use white outlined text on a
transparent background, sized to 6% of the view's shorter side. The fallback
updates on rotation and picture-in-picture layout changes. Explicitly enabled
Android accessibility captions retain their text color, font, and scale; their
background and window colors are cleared so the system caption preset cannot
reintroduce a black box. The fallback always has a black text outline.
A background authored in the subtitle itself is preserved.

This uses Media3's SSA/ASS parser, not libass. Complex ASS effects, karaoke,
custom font attachments, and exact authored outlines are not fully supported;
mpv can still render those differently. See the [Media3 SSA parser](https://github.com/androidx/media/blob/1.9.0/libraries/extractor/src/main/java/androidx/media3/extractor/text/ssa/SsaParser.java).

`npm ci` applies the versioned patch via `patch-package --error-on-fail`.
If install scripts are disabled, run `npm run postinstall` before building.
Android autolinking builds `expo-video` from source so the patch is included
instead of linking Expo's precompiled artifact. Review the patch when upgrading
Expo Video. A native rebuild is required;
Metro refresh alone cannot apply subtitle changes.

## Build and device validation

A native rebuild is required for `expo-linear-gradient` and the Expo Video
picture-in-picture configuration. Follow [the mobile runbook](../mobile-runbook.md):

```bash
source scripts/dev-env.sh
npm run android:dev
```

Type checking and lint can run without a phone. On a connected Android device,
check landscape entry and portrait restoration, portrait control wrapping,
seeking during torrent playback, lock/unlock, embedded track switching,
previous/next file selection, autoplay, and entering/returning from picture
in picture. Also check file preparation errors and leaving the player while
metadata or a file is loading.

### Validation performed

Checked on an Infinix X6731 running Android 16 on October 4, 2026, using the
installed development build and a local two-file torrent containing H.264
video, AAC audio, and embedded MP4 subtitles:

- Playback, pause/resume, seek bar, double-tap seek, horizontal seek gestures,
  volume gestures, playback speed, and remaining-time display.
- English/Japanese audio selection and visible English subtitles.
- Lock/unlock, landscape/portrait rotation, and picture-in-picture entry/return.
- Previous/next file playback and autoplay from the first file to the second.
- Exiting restores portrait and system bars, stops the foreground torrent
  service, and removes the active stream cache.

Device checks also exposed native streaming issues. The torrent engine now
retains magnet trackers/explicit peers when starting a download, keeps seed
connections available for file changes, clears old piece deadlines, and limits
prefetching to the selected file. Retained connections end with the player session.

Type checking, lint, and the Android development build passed. This fixture does
not establish support for every anime codec or subtitle format.
