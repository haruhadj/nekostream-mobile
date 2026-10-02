import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Keyboard, Linking, Platform, StyleSheet, Text, View } from "react-native";

import { formatBytes, formatRelative } from "@shared/format";
import { fetchReleases, type NyaaRelease } from "@shared/nyaa/rss";
import { theme } from "@/theme";
import { encodeTorrentMagnet } from "@/lib/torrent-route";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

export function NyaaSearch({
  english,
  romaji,
}: {
  english: string | null;
  romaji: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(english?.trim() || romaji.trim());
  const [releases, setReleases] = useState<NyaaRelease[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState<string[]>([]);
  const [limit, setLimit] = useState(5);
  const request = useRef(0);

  const search = useCallback(async (terms: string[]) => {
    const queries = terms
      .map((term) => term.trim())
      .filter(
        (term, index, all) =>
          term &&
          all.findIndex(
            (other) => other.toLowerCase() === term.toLowerCase(),
          ) === index,
      );
    if (!queries.length) return;
    const current = ++request.current;
    setBusy(true);
    setMessage(null);
    setReleases([]);
    setSearched(queries);
    setLimit(5);
    const results = await Promise.allSettled(
      queries.map((term) =>
        fetchReleases({ query: term, category: "1_2", filter: "0" }),
      ),
    );
    if (current !== request.current) return;
    const unique = new Map<number, NyaaRelease>();
    let failed = 0;
    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const release of result.value) unique.set(release.nyaaId, release);
      } else {
        failed++;
      }
    }
    setReleases(
      [...unique.values()].sort(
        (a, b) =>
          (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      ),
    );
    setMessage(
      failed === queries.length
        ? "Could not load Nyaa results. Check your connection and try again."
        : failed > 0
          ? "One title search failed. Showing results from the other title."
          : null,
    );
    setBusy(false);
  }, []);

  const invalidate = useCallback(() => {
    request.current++;
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(english?.trim() || romaji.trim());
      void search([english ?? "", romaji]);
    }, 0);
    return () => {
      clearTimeout(timer);
      invalidate();
    };
  }, [english, romaji, search, invalidate]);

  function submit() {
    Keyboard.dismiss();
    void search([query]);
  }

  async function open(uri: string, magnet = false) {
    try {
      await Linking.openURL(uri);
    } catch {
      Alert.alert(
        magnet ? "No app for magnet links" : "Could not open Nyaa",
        magnet
          ? "Install a torrent client that handles magnet links, then try again."
          : "Try opening the release again.",
      );
    }
  }

  const distinctEnglish =
    english?.trim() &&
    english.trim().toLowerCase() !== romaji.trim().toLowerCase();

  return (
    <View style={styles.section}>
      <Text style={styles.caption}>
        Find releases using this anime’s titles, or enter your own search.
      </Text>
      <Input
        icon="search"
        value={query}
        onChangeText={setQuery}
        placeholder="Anime title, episode or release group"
        accessibilityLabel="Nyaa search terms"
        returnKeyType="search"
        autoCorrect={false}
        onSubmitEditing={submit}
      />
      <View style={styles.actions}>
        <Button label="Search" onPress={submit} disabled={!query.trim()} />
        <Button
          label="Both titles"
          variant="outline"
          disabled={busy}
          onPress={() => void search([english ?? "", romaji])}
        />
      </View>
      {distinctEnglish ? (
        <View style={styles.actions}>
          <Button
            label="English"
            variant="ghost"
            onPress={() => {
              setQuery(english!.trim());
              void search([english!]);
            }}
          />
          <Button
            label="Romaji"
            variant="ghost"
            onPress={() => {
              setQuery(romaji.trim());
              void search([romaji]);
            }}
          />
        </View>
      ) : null}
      <Text style={styles.caption} accessibilityLiveRegion="polite">
        {busy
          ? "Searching Nyaa…"
          : (message ?? `${releases.length} releases found`)}
      </Text>
      {!busy && message ? (
        <Button
          label="Retry"
          variant="outline"
          onPress={() => void search(searched)}
        />
      ) : null}
      {!busy && !message && releases.length === 0 ? (
        <Text style={styles.caption}>
          No releases found. Try a shorter title or another spelling.
        </Text>
      ) : null}
      {releases.slice(0, limit).map((release) => (
        <View key={release.nyaaId} style={styles.release}>
          <Text style={styles.title} selectable>
            {release.rawTitle}
          </Text>
          <Text style={styles.caption}>
            {[
              release.isBatch
                ? "Batch"
                : release.episodeNumber !== null
                  ? `Episode ${release.episodeNumber}`
                  : null,
              release.quality,
              formatBytes(release.sizeBytes),
              release.seeders !== null ? `${release.seeders} seeders` : null,
              formatRelative(release.publishedAt),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <View style={styles.actions}>
            {Platform.OS === "android" ? (
              <Button
                label="Play"
                size="sm"
                onPress={() => router.push({
                  pathname: "/player",
                  params: { magnet: encodeTorrentMagnet(release.magnetUri), title: release.rawTitle },
                })}
              />
            ) : null}
            <Button
              label="View release"
              variant="outline"
              size="sm"
              onPress={() =>
                void open(`https://nyaa.si/view/${release.nyaaId}`)
              }
            />
            <Button
              label="Open magnet"
              variant="outline"
              size="sm"
              onPress={() => void open(release.magnetUri, true)}
            />
          </View>
        </View>
      ))}
      {releases.length > limit ? (
        <Button
          label="Show more releases"
          variant="outline"
          onPress={() => setLimit((value) => value + 10)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  caption: { color: theme.color.muted, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  release: {
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  title: { color: theme.color.foreground, fontSize: 14, lineHeight: 21 },
});
