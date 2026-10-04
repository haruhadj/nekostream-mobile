# Playback and torrent preferences

Open **You → Player and torrent settings**, or **Player settings → Player and
torrent preferences** inside a video. Preferences are stored on the device and
survive app restarts. Each category can be reset independently.

The categories are based on Anikku's [player settings](https://github.com/komikku-app/anikku/tree/49eadfcc28088fbad17a4f194d40bf997955796b/app/src/main/java/eu/kanade/presentation/more/settings/screen/player)
and [torrent preferences](https://github.com/komikku-app/anikku/blob/49eadfcc28088fbad17a4f194d40bf997955796b/core/common/src/main/java/eu/kanade/tachiyomi/torrentServer/TorrentServerPreferences.kt),
adapted to NekoStream's Expo Video / libtorrent engine.

## Included

| Category | Working preferences |
| --- | --- |
| Internal player | Resume position, autoplay, orientation, sizing, default speed, control timeout, remaining time, PiP button, reduced animation |
| Gestures | Double-tap seek distance, center double-tap play/pause, horizontal seeking, volume swipes, intro skip duration |
| Subtitles | Enable by default, preferred language, exclude track names from automatic selection |
| Audio | Preferred language, pitch correction |
| Torrent server | Stream port, additional trackers, DHT, local discovery, connection limit, upload/download limits, metadata timeout, unused-cache cleanup |

Playback defaults apply when entering the player. Opening preferences from a
video stops its torrent session; returning prepares the same selected file
again, using the updated preferences and saved position if resume is enabled.
Manual track choices, speed, rotation, sizing, and autoplay controls still work
within the current playback session.

Resume positions are kept for the last 100 videos, identified by magnet hash
and file index. The app saves every 10 seconds, on file changes, and on leaving
the player. Positions within five seconds of the end restart from the beginning.
This does not mark episodes watched or change AniList/MyAnimeList progress.

Preferred languages match the tracks the device exposes, including common
three-letter language codes. Missing audio preferences keep the video's
selection. Subtitle exclusions are comma-separated words matched against track
names/labels; they affect automatic selection, while manual choices remain
available. Missing subtitle preferences fall back to an eligible default/first
track. The default “Automatic (prefer English)” selects English when available,
then an eligible default/first track. English tracks with missing language tags
can also match an English name/label. Expo disables subtitles for each new
source, so the app explicitly selects a track when subtitles are enabled.
Manual subtitle choices, including Off, remain in effect for the current video;
the preference is applied again when another video loads.

## Torrent settings

The server port is the **local HTTP video stream port**, not an external
TorrServer address or a peer listening port. It binds to `127.0.0.1` only.
The default `0` picks an available port. Explicit ports range from 1024 to
65535; an occupied port reports an actionable playback error.

Additional trackers are optional HTTP, HTTPS, or UDP URLs, one per line (up to
40). Magnet trackers and explicit peers remain intact. Custom trackers are
added only after metadata identifies a public torrent. Private torrents keep
their original trackers. The default is no additional trackers, rather than
copying Anikku's old tracker list.

Torrent preferences apply to the next prepared session. Transfer limits are
in KiB/s; `0` means unlimited. Libtorrent's local-peer classes may be exempt
from global transfer limits. Cache cleanup removes only unused files under the
app's torrent-stream cache and excludes the active engine's directory. Normal
player exit still removes its own temporary files.

## Engine-dependent features

The current engine does not expose mpv hardware-decoder selection, pixel format,
debanding, ASS font overrides, audio/subtitle timing offsets, channel remapping,
Lua custom buttons/scripts, `mpv.conf`, or `input.conf`. These need a native
playback-engine extension or an mpv integration before they can be useful UI
settings. Brightness gestures and system volume controls would also need native
integration; current volume swipes adjust the video player's volume.

## Device checks

On October 4, 2026, the Infinix X6731 development build passed checks for:

- Saving preferences through the UI and retaining them after an app restart.
- Rejecting a reserved stream port and a non-tracker URL.
- Applying portrait orientation, 1.5x playback, a 35-second skip button, and
  a fixed loopback stream port.
- Automatically selecting Japanese audio and English subtitles in the local
  video fixture.
- Returning from preferences to the same selected video, restoring its saved
  playback position, and showing the updated remaining-time default.
- Resetting each category independently. Temporary test preferences were reset.

Type checking, lint, and the Android native build passed. Public tracker
fallback, remote transfer-rate limits, and cache deletion were not exercised
in these device checks.
