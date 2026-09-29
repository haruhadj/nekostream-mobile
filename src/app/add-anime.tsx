import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { parseAnimeLink } from "@/data/anime-link";
import { resolveAnimeLink, type LinkedAnime } from "@/data/linked-anime";
import { addEntry, entryByMediaId } from "@/db/library";
import { theme } from "@/theme";
import { Button } from "@/ui/button";
import { Screen, ScreenTitle, SCREEN_PADDING } from "@/ui/screen";

export default function AddAnimeScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  const router = useRouter();
  const [anime, setAnime] = useState<LinkedAnime | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const link = typeof url === "string" ? parseAnimeLink(url) : null;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setAnime(null);
      setError(null);
      setLoading(true);
      setExistingId(null);
      void (async () => {
        try {
          const parsed = typeof url === "string" ? parseAnimeLink(url) : null;
          if (!parsed)
            throw new Error(
              "Use an AniList or MyAnimeList anime link. Manga, profiles, lists and other pages are not supported.",
            );
          const found = await resolveAnimeLink(parsed);
          const existing = await entryByMediaId(found.id);
          if (!cancelled) {
            setAnime(found);
            setExistingId(existing?.id ?? null);
          }
        } catch (thrown) {
          if (!cancelled)
            setError(
              thrown instanceof Error
                ? thrown.message
                : "Could not load this anime.",
            );
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, attempt]);

  async function add() {
    if (!anime) return;
    setBusy(true);
    setError(null);
    try {
      await addEntry({
        anilistMediaId: anime.id,
        malMediaId: anime.idMal,
        titleRomaji: anime.title.romaji,
        titleEnglish: anime.title.english,
        coverImageUrl: anime.coverImage?.large ?? null,
        totalEpisodes: anime.episodes,
      });
      const entry = await entryByMediaId(anime.id);
      if (!entry) throw new Error("Could not find the added anime. Try again.");
      router.replace({ pathname: "/anime/[id]", params: { id: entry.id } });
    } catch (thrown) {
      setError(
        thrown instanceof Error ? thrown.message : "Could not add this anime.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="Quick add"
          subtitle="Add an anime to your device library."
        />
        {loading ? <Text style={styles.body}>Loading anime…</Text> : null}
        {anime ? (
          <>
            <Image
              source={
                anime.coverImage?.large ? { uri: anime.coverImage.large } : null
              }
              style={styles.poster}
              contentFit="cover"
            />
            <Text style={styles.title}>
              {anime.title.english ?? anime.title.romaji}
            </Text>
            {anime.title.english ? (
              <Text style={styles.body}>{anime.title.romaji}</Text>
            ) : null}
            <Text style={styles.body}>
              {existingId
                ? "Already in your library."
                : "Ready to add to your library."}
            </Text>
            <Button
              label={existingId ? "Open anime" : "Add to library"}
              busy={busy}
              onPress={() =>
                existingId
                  ? router.replace({
                      pathname: "/anime/[id]",
                      params: { id: existingId },
                    })
                  : void add()
              }
            />
          </>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {!loading && !anime && link ? (
          <Button
            label="Try again"
            variant="outline"
            onPress={() => setAttempt((n) => n + 1)}
          />
        ) : null}
        <Button
          label="Back to app"
          variant="ghost"
          onPress={() => router.replace("/")}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SCREEN_PADDING, gap: 16, paddingBottom: 32 },
  poster: {
    width: 140,
    height: 210,
    borderRadius: 12,
    backgroundColor: theme.color.surface,
  },
  title: { ...theme.type.title, color: theme.color.foreground },
  body: { ...theme.type.body, color: theme.color.muted },
  error: { ...theme.type.body, color: theme.color.danger },
});
