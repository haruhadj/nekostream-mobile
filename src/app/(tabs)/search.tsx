import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { parseAnimeLink } from "@/data/anime-link";

import { searchMedia, trendingMedia } from "@shared/anilist/queries";
import type { AniListMedia } from "@shared/anilist/queries";

import { useQuery } from "@/data/use-query";
import { addEntry, libraryMediaIds } from "@/db/library";
import {
  SearchResultCard,
  type AddState,
} from "@/components/search-result-card";
import { theme } from "@/theme";
import { GRID_COLUMNS, GRID_GAP } from "@/ui/anime-grid";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { EmptyState, Screen, ScreenTitle, SCREEN_PADDING } from "@/ui/screen";

/** Long enough that typing a title doesn't fire a request per keystroke. */
const DEBOUNCE_MS = 350;

/**
 * The search tab — the web's `/search` page, now talking to AniList itself
 * through the shared `@shared/anilist/queries`. An empty query shows AniList's
 * trending list, so this is never a blank screen. Neither call needs a token:
 * search and metadata are public, which is why this tab works even when the
 * AniList token has expired.
 *
 * Adding a title writes one row to the device database and needs no hand-off
 * to the Library tab: that screen re-reads on focus.
 */
export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [media, setMedia] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addStates, setAddStates] = useState<Record<number, AddState>>({});
  const [justAdded, setJustAdded] = useState<ReadonlySet<number>>(new Set());

  // Which AniList ids the library already holds, so results show the right
  // state. Re-read on focus, which also clears `justAdded`'s job.
  const { data: ids } = useQuery(
    libraryMediaIds,
    "Could not read your library.",
  );

  const libraryIds = useMemo(() => new Set(ids ?? []), [ids]);

  const isInLibrary = useCallback(
    (id: number) => libraryIds.has(id) || justAdded.has(id),
    [libraryIds, justAdded],
  );

  // Only the newest search may write results: a slow request for "fu" must not
  // land on top of a fast one for "fullmetal".
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const id = ++requestId.current;
    let cancelled = false;

    // Everything happens on the far side of the debounce, including the
    // "Searching…" flag — a request that hasn't been made yet isn't in
    // flight, and flipping state in the effect body itself would cascade a
    // render on every keystroke.
    const timer = setTimeout(() => {
      setSearching(true);
      setError(null);

      void (async () => {
        try {
          if (/^https?:\/\//i.test(trimmed)) {
            if (cancelled || id !== requestId.current) return;
            setMedia([]);
            setError(
              parseAnimeLink(trimmed)
                ? null
                : "Only AniList and MyAnimeList anime links are supported.",
            );
            setSearching(false);
            return;
          }
          // Empty query means "show me something" — the same split the web's
          // /api/anilist/search route made server-side.
          const page = trimmed
            ? await searchMedia(trimmed)
            : await trendingMedia();

          if (cancelled || id !== requestId.current) return;
          setMedia(page.media);
          setError(null);
        } catch (thrown) {
          if (cancelled || id !== requestId.current) return;
          setMedia([]);
          setError(thrown instanceof Error ? thrown.message : "Search failed.");
        }

        setSearching(false);
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, attempt]);

  const add = useCallback(async (item: AniListMedia) => {
    setAddError(null);
    setAddStates((states) => ({ ...states, [item.id]: "adding" }));

    try {
      await addEntry({
        anilistMediaId: item.id,
        malMediaId: item.idMal,
        titleRomaji: item.title.romaji,
        titleEnglish: item.title.english,
        coverImageUrl: item.coverImage?.large ?? null,
        totalEpisodes: item.episodes,
      });
    } catch (thrown) {
      // Back to idle, not stuck mid-add — the card stays retryable.
      setAddStates((states) => ({ ...states, [item.id]: "idle" }));
      setAddError(
        thrown instanceof Error ? thrown.message : "Could not add that title.",
      );
      return;
    }

    setJustAdded((added) => new Set(added).add(item.id));
    setAddStates((states) => ({ ...states, [item.id]: "added" }));
  }, []);

  const status = error
    ? "Couldn’t load anime"
    : searching
      ? "Searching…"
      : query.trim()
        ? `${media.length} results`
        : "Trending now";

  return (
    <Screen>
      <FlatList
        data={media}
        keyExtractor={(item) => String(item.id)}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <SearchResultCard
            media={item}
            inLibrary={isInLibrary(item.id)}
            addState={addStates[item.id] ?? "idle"}
            onAdd={() => void add(item)}
          />
        )}
        ListHeaderComponent={
          <View>
            <ScreenTitle title="Discover" subtitle="Find your next favorite." />

            <Input
              value={query}
              onChangeText={setQuery}
              icon="search"
              placeholder="Search anime or paste an anime link"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
              style={styles.search}
              accessibilityLabel="Search anime on AniList"
              onSubmitEditing={() => {
                if (parseAnimeLink(query))
                  router.push({
                    pathname: "/add-anime",
                    params: { url: query.trim() },
                  });
              }}
            />

            {parseAnimeLink(query) ? (
              <Button
                label="Open anime link"
                style={{ marginTop: 12 }}
                onPress={() =>
                  router.push({
                    pathname: "/add-anime",
                    params: { url: query.trim() },
                  })
                }
              />
            ) : null}

            <Text
              style={[styles.status, error ? styles.statusError : null]}
              accessibilityLiveRegion="polite"
            >
              {status}
            </Text>
            {addError ? (
              <Text accessibilityLiveRegion="polite" style={styles.addError}>
                {addError} Tap Add to try again.
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          searching ? (
            <EmptyState
              title="Finding your next anime"
              message="Loading anime from AniList…"
              icon="search"
            />
          ) : (
            <EmptyState
              title={
                error
                  ? "Couldn’t load anime"
                  : parseAnimeLink(query)
                    ? "Anime link ready"
                    : "No matches this time"
              }
              message={
                error
                  ? error
                  : parseAnimeLink(query)
                    ? "Tap Open anime link to preview and add this title."
                    : "Try another title or a shorter search."
              }
              icon="search"
            >
              {error ? (
                <Button
                  label="Try again"
                  variant="outline"
                  onPress={() => setAttempt((value) => value + 1)}
                />
              ) : null}
            </EmptyState>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32, gap: 20 },
  column: { gap: GRID_GAP },
  search: { marginTop: 20 },
  status: {
    marginTop: 24,
    marginBottom: 4,
    color: theme.color.foreground,
    ...theme.type.section,
  },
  addError: { ...theme.type.body, color: theme.color.danger, marginTop: 12 },
  statusError: { color: theme.color.danger },
});
