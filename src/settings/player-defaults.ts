import type { AudioTrack, SubtitleTrack, VideoPlayer } from "expo-video";
import type { Preferences } from "./preferences";

const LANGUAGE_ALIASES: Record<string, string> = {
  eng: "en",
  jpn: "ja",
  spa: "es",
  fra: "fr",
  fre: "fr",
  deu: "de",
  ger: "de",
  kor: "ko",
  zho: "zh",
  chi: "zh",
  tgl: "fil",
  tl: "fil",
};
function matchesLanguage(
  track: { language?: string | null },
  language: string,
) {
  const code = (track.language ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return (LANGUAGE_ALIASES[code] ?? code) === language;
}

export function applyTrackPreferences(
  player: VideoPlayer,
  preferences: Preferences,
  audio: AudioTrack[],
  subtitles: SubtitleTrack[],
) {
  if (preferences.audioLanguage !== "auto") {
    const preferred = audio.find((track) =>
      matchesLanguage(track, preferences.audioLanguage),
    );
    if (preferred) player.audioTrack = preferred;
  }
  if (!preferences.subtitlesEnabled) {
    player.subtitleTrack = null;
    return;
  }
  const excluded = preferences.subtitleExclude
    .split(",")
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  const eligible = subtitles.filter(
    (track) =>
      !excluded.some((word) =>
        `${track.label} ${track.name ?? ""}`.toLowerCase().includes(word),
      ),
  );
  const language =
    preferences.subtitleLanguage === "auto" ? "en" : preferences.subtitleLanguage;
  const matching = eligible.filter(
    (track) =>
      matchesLanguage(track, language) ||
      (language === "en" &&
        (!track.language || track.language.toLowerCase() === "und") &&
        /\benglish\b/i.test(`${track.label} ${track.name ?? ""}`)),
  );
  const preferred = matching.find((track) => track.isDefault) ?? matching[0];
  const fallback = eligible.find((track) => track.isDefault) ?? eligible[0];
  // Expo disables subtitles for every new source, so even automatic mode must
  // explicitly select a track to honor "Enable subtitles by default".
  player.subtitleTrack = preferred ?? fallback ?? null;
}

export function applyPlaybackDefaults(
  player: VideoPlayer,
  preferences: Preferences,
) {
  player.playbackRate = preferences.playbackSpeed;
  player.preservesPitch = preferences.preservePitch;
}
