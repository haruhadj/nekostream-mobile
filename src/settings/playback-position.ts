import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nekostream.playback-positions.v1";
type Position = { seconds: number; updated: number };
let pending: Promise<unknown> = Promise.resolve();

export function playbackPositionKey(magnet: string, fileIndex: number) {
  const hash = /urn:btih:([^&]+)/i.exec(magnet)?.[1].toLowerCase();
  return hash ? `${hash}:${fileIndex}` : null;
}

async function readPositions(): Promise<Record<string, Position>> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return {};
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, entry]) =>
          entry &&
          typeof entry === "object" &&
          Number.isFinite(entry.seconds) &&
          Number.isFinite(entry.updated),
      ),
    );
  } catch {
    return {};
  }
}

export async function getPlaybackPosition(key: string | null) {
  if (!key) return 0;
  await pending.catch(() => {});
  const entry = (await readPositions())[key];
  return Number.isFinite(entry?.seconds) && entry.seconds > 0
    ? entry.seconds
    : 0;
}

export function savePlaybackPosition(
  key: string | null,
  seconds: number,
  duration: number,
) {
  if (!key || !Number.isFinite(seconds) || duration <= 0)
    return Promise.resolve();
  const operation = pending
    .catch(() => {})
    .then(async () => {
      const entries = await readPositions();
      const position = seconds >= duration - 5 ? 0 : Math.max(0, seconds);
      entries[key] = { seconds: position, updated: Date.now() };
      const recent = Object.entries(entries)
        .sort(([, a], [, b]) => b.updated - a.updated)
        .slice(0, 100);
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Object.fromEntries(recent)),
      );
    });
  pending = operation;
  return operation;
}
