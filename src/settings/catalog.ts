import type { Preferences } from "./preferences";

type Choice = { key: string; label: string };
export type Setting = {
  key: keyof Preferences;
  title: string;
  detail?: string;
} & (
  | { kind: "toggle" }
  | { kind: "select"; choices: Choice[]; numeric?: boolean }
  | { kind: "text"; multiline?: boolean }
  | { kind: "number"; min: number; max: number; zeroLabel?: string }
);
const seconds = (values: number[]) =>
  values.map((value) => ({ key: String(value), label: `${value} seconds` }));
const languages: Choice[] = [
  { key: "auto", label: "Follow the video default" },
  { key: "ja", label: "Japanese" },
  { key: "en", label: "English" },
  { key: "fil", label: "Filipino" },
  { key: "es", label: "Spanish" },
  { key: "fr", label: "French" },
  { key: "de", label: "German" },
  { key: "ko", label: "Korean" },
  { key: "zh", label: "Chinese" },
];
export const SETTINGS_CATEGORIES = {
  player: {
    title: "Internal player",
    icon: "play-circle",
    detail: "Playback, progress, controls, orientation",
    settings: [
      {
        key: "resumePlayback",
        title: "Resume playback",
        detail: "Remember your position in the last 100 videos.",
        kind: "toggle",
      },
      {
        key: "autoPlay",
        title: "Autoplay next file",
        detail: "Continue to the next video in the same torrent.",
        kind: "toggle",
      },
      {
        key: "orientation",
        title: "Default orientation",
        kind: "select",
        choices: [
          { key: "landscape", label: "Landscape" },
          { key: "portrait", label: "Portrait" },
        ],
      },
      {
        key: "contentFit",
        title: "Default video sizing",
        kind: "select",
        choices: [
          { key: "contain", label: "Fit" },
          { key: "cover", label: "Crop to fill" },
          { key: "fill", label: "Stretch" },
        ],
      },
      {
        key: "playbackSpeed",
        title: "Default playback speed",
        kind: "select",
        numeric: true,
        choices: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map(
          (speed) => ({ key: String(speed), label: `${speed}x` }),
        ),
      },
      {
        key: "controlsTimeout",
        title: "Hide controls after",
        kind: "select",
        numeric: true,
        choices: [
          { key: "0", label: "Keep visible" },
          ...seconds([2, 4, 6, 10, 15]),
        ],
      },
      {
        key: "showRemainingTime",
        title: "Show remaining time",
        kind: "toggle",
      },
      {
        key: "pictureInPicture",
        title: "Picture in picture",
        detail: "Show the PiP button on supported devices.",
        kind: "toggle",
      },
      {
        key: "reduceMotion",
        title: "Reduce player animations",
        kind: "toggle",
      },
    ],
  },
  gestures: {
    title: "Gestures",
    icon: "move",
    detail: "Seeking, double tap, volume, intro skip",
    settings: [
      {
        key: "doubleTapSeek",
        title: "Double-tap seek distance",
        kind: "select",
        numeric: true,
        choices: [
          { key: "0", label: "Disabled" },
          ...seconds([5, 10, 15, 20, 30]),
        ],
      },
      {
        key: "doubleTapPlayPause",
        title: "Double tap center to play/pause",
        kind: "toggle",
      },
      {
        key: "horizontalSeek",
        title: "Swipe horizontally to seek",
        kind: "toggle",
      },
      {
        key: "volumeGesture",
        title: "Swipe vertically for volume",
        kind: "toggle",
      },
      {
        key: "introSkipSeconds",
        title: "Intro skip button duration",
        detail: "Fixed skip distance. Set 0 to hide the button.",
        kind: "number",
        min: 0,
        max: 300,
        zeroLabel: "Hidden",
      },
    ],
  },
  subtitles: {
    title: "Subtitles",
    icon: "type",
    detail: "Default language and track filtering",
    settings: [
      {
        key: "subtitlesEnabled",
        title: "Enable subtitles by default",
        kind: "toggle",
      },
      {
        key: "subtitleLanguage",
        title: "Preferred subtitle language",
        detail:
          "Automatic prefers English. Falls back to the video default or first available track.",
        kind: "select",
        choices: languages.map((choice) =>
          choice.key === "auto"
            ? { ...choice, label: "Automatic (prefer English)" }
            : choice,
        ),
      },
      {
        key: "subtitleExclude",
        title: "Exclude track names",
        detail:
          "Comma-separated words, such as signs, songs. Used only for automatic selection.",
        kind: "text",
      },
    ],
  },
  audio: {
    title: "Audio",
    icon: "music",
    detail: "Preferred language and pitch correction",
    settings: [
      {
        key: "audioLanguage",
        title: "Preferred audio language",
        detail: "Falls back to the video default when unavailable.",
        kind: "select",
        choices: languages,
      },
      {
        key: "preservePitch",
        title: "Pitch correction",
        detail: "Keep voices at their normal pitch when changing speed.",
        kind: "toggle",
      },
    ],
  },
  torrent: {
    title: "Torrent server",
    icon: "server",
    detail: "Port, trackers, connections, transfer limits",
    settings: [
      {
        key: "serverPort",
        title: "Torrent server port",
        detail:
          "Local video stream port. 0 chooses an available port automatically. Changes apply to the next stream.",
        kind: "number",
        min: 1024,
        max: 65535,
        zeroLabel: "Automatic",
      },
      {
        key: "trackers",
        title: "Additional trackers",
        detail:
          "One HTTP, HTTPS, or UDP URL per line. Added to public torrents after metadata loads; private torrents keep their own trackers.",
        kind: "text",
        multiline: true,
      },
      { key: "enableDht", title: "DHT peer discovery", kind: "toggle" },
      {
        key: "enableLocalDiscovery",
        title: "Local peer discovery",
        detail: "Find peers on the same network.",
        kind: "toggle",
      },
      {
        key: "maxConnections",
        title: "Maximum peer connections",
        kind: "number",
        min: 10,
        max: 200,
      },
      {
        key: "downloadLimitKiB",
        title: "Download limit (KiB/s)",
        detail: "0 means unlimited.",
        kind: "number",
        min: 0,
        max: 100000,
        zeroLabel: "Unlimited",
      },
      {
        key: "uploadLimitKiB",
        title: "Upload limit (KiB/s)",
        detail: "0 means unlimited. Uploading helps other peers.",
        kind: "number",
        min: 0,
        max: 100000,
        zeroLabel: "Unlimited",
      },
      {
        key: "metadataTimeout",
        title: "Metadata timeout (seconds)",
        kind: "number",
        min: 15,
        max: 180,
      },
    ],
  },
} satisfies Record<
  string,
  {
    title: string;
    icon: "play-circle" | "move" | "type" | "music" | "server";
    detail: string;
    settings: Setting[];
  }
>;
export type SettingsCategory = keyof typeof SETTINGS_CATEGORIES;
