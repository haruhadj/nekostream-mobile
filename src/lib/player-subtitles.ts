import type { SubtitleTrack } from "expo-video";

/** Prefer full English dialogue over signs-only tracks, then the file's default. */
export function selectDefaultSubtitle(tracks: SubtitleTrack[]): SubtitleTrack | null {
  const english = tracks.filter((track) =>
    /^(en|eng|english)([-_]|$)/i.test(track.language.trim()) ||
    /\b(english|eng|en)\b/i.test(`${track.name ?? ""} ${track.label}`),
  );
  const dialogue = english.filter((track) =>
    !/\b(signs?|songs?|forced)\b/i.test(`${track.name ?? ""} ${track.label}`),
  );
  const preferred = dialogue.length ? dialogue : english;
  return preferred.find((track) => track.isDefault) ?? preferred[0]
    ?? tracks.find((track) => track.isDefault) ?? tracks[0] ?? null;
}
