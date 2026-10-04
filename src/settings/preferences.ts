import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";

const language = z.enum([
  "auto",
  "ja",
  "en",
  "fil",
  "es",
  "fr",
  "de",
  "ko",
  "zh",
]);
const integer = (min: number, max: number, fallback: number) =>
  z.number().int().min(min).max(max).catch(fallback);

export const preferencesSchema = z.object({
  orientation: z.enum(["landscape", "portrait"]).catch("landscape"),
  contentFit: z.enum(["contain", "cover", "fill"]).catch("contain"),
  autoPlay: z.boolean().catch(false),
  resumePlayback: z.boolean().catch(true),
  playbackSpeed: z.number().min(0.25).max(3).catch(1),
  controlsTimeout: integer(0, 30, 4),
  showRemainingTime: z.boolean().catch(false),
  reduceMotion: z.boolean().catch(false),
  pictureInPicture: z.boolean().catch(true),
  doubleTapSeek: integer(0, 60, 10),
  doubleTapPlayPause: z.boolean().catch(true),
  horizontalSeek: z.boolean().catch(true),
  volumeGesture: z.boolean().catch(true),
  introSkipSeconds: integer(0, 300, 85),
  audioLanguage: language.catch("auto"),
  subtitleLanguage: language.catch("auto"),
  subtitlesEnabled: z.boolean().catch(true),
  subtitleExclude: z.string().max(500).catch(""),
  preservePitch: z.boolean().catch(true),
  serverPort: z
    .number()
    .int()
    .refine((value) => value === 0 || (value >= 1024 && value <= 65535))
    .catch(0),
  trackers: z.string().max(8000).catch(""),
  enableDht: z.boolean().catch(true),
  enableLocalDiscovery: z.boolean().catch(true),
  maxConnections: integer(10, 200, 80),
  downloadLimitKiB: integer(0, 100000, 0),
  uploadLimitKiB: integer(0, 100000, 0),
  metadataTimeout: integer(15, 180, 60),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const DEFAULT_PREFERENCES = preferencesSchema.parse({});
const STORAGE_KEY = "nekostream.preferences.v1";
let snapshot = { values: DEFAULT_PREFERENCES, ready: false, error: "" };
const listeners = new Set<() => void>();
let loading: Promise<Preferences> | undefined;
let saving: Promise<unknown> = Promise.resolve();

function publish(values: Preferences, error = "") {
  snapshot = { values, ready: true, error };
  listeners.forEach((listener) => listener());
}

export function loadPreferences(): Promise<Preferences> {
  loading ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      const values = preferencesSchema.parse(stored ? JSON.parse(stored) : {});
      publish(values);
      return values;
    })
    .catch((cause) => {
      loading = undefined;
      publish(DEFAULT_PREFERENCES, "Could not load saved preferences.");
      throw cause;
    });
  return loading.then(() => snapshot.values);
}

export function savePreferences(patch: Partial<Preferences>): Promise<void> {
  const operation = saving
    .catch(() => {})
    .then(async () => {
      await loadPreferences();
      const values = preferencesSchema.parse({ ...snapshot.values, ...patch });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      publish(values);
    });
  saving = operation;
  return operation;
}

export function usePreferences() {
  useEffect(() => {
    void loadPreferences().catch(() => {});
  }, []);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => snapshot,
  );
}

export function validateTrackers(value: string): string {
  if (value.length > 8000)
    throw new Error("Use at most 8000 characters for trackers.");
  const urls = [...new Set(value.split(/\s+/).filter(Boolean))];
  if (urls.length > 40) throw new Error("Use at most 40 tracker URLs.");
  for (const tracker of urls) {
    let url: URL;
    try {
      url = new URL(tracker);
    } catch {
      throw new Error(`Invalid tracker URL: ${tracker}`);
    }
    if (
      !["http:", "https:", "udp:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash
    ) {
      throw new Error(
        `Use HTTP, HTTPS, or UDP tracker URLs without credentials: ${tracker}`,
      );
    }
    if (
      url.protocol === "udp:" &&
      (!url.port || Number(url.port) < 1 || Number(url.port) > 65535)
    )
      throw new Error("UDP trackers need a port.");
  }
  return urls.join("\n");
}
