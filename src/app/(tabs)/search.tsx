import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SearchResultCard,
  type AddState,
} from "@/components/search-result-card";
import { parseAnimeLink } from "@/data/anime-link";
import {
  discoverAnime,
  type DiscoverFormat,
  type DiscoverMedia,
  type DiscoverPage,
  type DiscoverSeason,
  type DiscoverSort,
} from "@/data/discover";
import { useQuery } from "@/data/use-query";
import { addEntry, entryByMediaId, libraryMediaIds } from "@/db/library";
import { useNow } from "@/hooks/use-now";
import { theme } from "@/theme";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { EmptyState, Screen, ScreenTitle, SCREEN_PADDING } from "@/ui/screen";

type BrowseMode = "season" | "airing" | "upcoming" | "trending";
type Snapshot = { key: string; page: DiscoverPage };

const SEASONS: { label: string; value: DiscoverSeason }[] = [
  { label: "Winter", value: "WINTER" },
  { label: "Spring", value: "SPRING" },
  { label: "Summer", value: "SUMMER" },
  { label: "Fall", value: "FALL" },
];
const FORMATS: { label: string; value: DiscoverFormat }[] = [
  { label: "All", value: "all" },
  { label: "TV", value: "tv" },
  { label: "Movies", value: "movie" },
  { label: "OVA", value: "ova" },
  { label: "ONA", value: "ona" },
];
const SORTS: { label: string; value: DiscoverSort }[] = [
  { label: "Popular", value: "POPULARITY_DESC" },
  { label: "Trending", value: "TRENDING_DESC" },
  { label: "Top rated", value: "SCORE_DESC" },
];
const CACHE_MS = 5 * 60_000;
const CACHE_ITEMS = 12;

function seasonAt(index: number) {
  const season = SEASONS[((index % 4) + 4) % 4];
  return { ...season, year: Math.floor(index / 4) };
}

export default function SearchScreen() {
  const router = useRouter();
  const now = useNow();
  const [baseSeason] = useState(() => {
    const date = new Date();
    return date.getFullYear() * 4 + Math.floor(date.getMonth() / 3);
  });
  const [seasonOffset, setSeasonOffset] = useState(0);
  const [mode, setMode] = useState<BrowseMode>("season");
  const [format, setFormat] = useState<DiscoverFormat>("all");
  const [sort, setSort] = useState<DiscoverSort>("POPULARITY_DESC");
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [searching, setSearching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorState, setErrorState] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addStates, setAddStates] = useState<Record<number, AddState>>({});
  const [justAdded, setJustAdded] = useState<ReadonlySet<number>>(new Set());

  const { data: ids } = useQuery(
    libraryMediaIds,
    "Could not read your library.",
  );
  const libraryIds = useMemo(() => new Set(ids ?? []), [ids]);
  const isInLibrary = useCallback(
    (id: number) => libraryIds.has(id) || justAdded.has(id),
    [libraryIds, justAdded],
  );

  const trimmed = query.trim();
  const season = seasonAt(baseSeason + seasonOffset);
  const isLink = /^https?:\/\//i.test(trimmed);
  const parsedLink = useMemo(
    () => (isLink ? parseAnimeLink(trimmed) : null),
    [isLink, trimmed],
  );
  const cacheKey = JSON.stringify([
    trimmed.toLowerCase(),
    mode,
    seasonOffset,
    format,
    sort,
  ]);
  const requestKey = `${cacheKey}:${attempt}`;
  const requestOptions = useMemo(() => {
    if (trimmed) return { search: trimmed, sort: "SEARCH_MATCH" as const };
    return {
      season: mode === "season" ? season.value : null,
      seasonYear: mode === "season" ? season.year : null,
      status:
        mode === "airing"
          ? ("RELEASING" as const)
          : mode === "upcoming"
            ? ("NOT_YET_RELEASED" as const)
            : null,
      format,
      sort: mode === "trending" ? ("TRENDING_DESC" as const) : sort,
    };
  }, [trimmed, mode, season.value, season.year, format, sort]);

  const cache = useRef(
    new Map<string, { savedAt: number; page: DiscoverPage }>(),
  );
  const requestId = useRef(0);
  const remember = useCallback((key: string, page: DiscoverPage) => {
    cache.current.delete(key);
    cache.current.set(key, { savedAt: Date.now(), page });
    if (cache.current.size > CACHE_ITEMS) {
      const oldest = cache.current.keys().next().value;
      if (oldest) cache.current.delete(oldest);
    }
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        setSearching(true);
        setErrorState(null);
        setLoadingMore(false);

        if (isLink) {
          setSnapshot({
            key: requestKey,
            page: {
              media: [],
              pageInfo: { total: 0, currentPage: 1, hasNextPage: false },
            },
          });
          setErrorState(
            parsedLink
              ? null
              : {
                  key: requestKey,
                  message:
                    "Only AniList and MyAnimeList anime links are supported.",
                },
          );
          setSearching(false);
          return;
        }

        const cached = cache.current.get(cacheKey);
        if (cached && Date.now() - cached.savedAt < CACHE_MS) {
          setSnapshot({ key: requestKey, page: cached.page });
          setSearching(false);
          return;
        }

        void (async () => {
          try {
            const page = await discoverAnime(requestOptions);
            if (cancelled || id !== requestId.current) return;
            remember(cacheKey, page);
            setSnapshot({ key: requestKey, page });
          } catch (thrown) {
            if (cancelled || id !== requestId.current) return;
            setSnapshot(null);
            setErrorState({
              key: requestKey,
              message:
                thrown instanceof Error
                  ? thrown.message
                  : "Could not load anime.",
            });
          } finally {
            if (!cancelled && id === requestId.current) setSearching(false);
          }
        })();
      },
      trimmed && !isLink ? 700 : 220,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    cacheKey,
    isLink,
    parsedLink,
    requestKey,
    requestOptions,
    remember,
    trimmed,
  ]);

  const visible = snapshot?.key === requestKey ? snapshot.page : null;
  const media = visible?.media ?? [];
  const error = errorState?.key === requestKey ? errorState.message : null;
  const working = searching || (!visible && !error);

  const loadMore = useCallback(async () => {
    if (!visible?.pageInfo.hasNextPage || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    setErrorState(null);
    try {
      const next = await discoverAnime({
        ...requestOptions,
        page: visible.pageInfo.currentPage + 1,
      });
      if (id !== requestId.current) return;
      const byId = new Map<number, DiscoverMedia>();
      for (const item of [...visible.media, ...next.media])
        byId.set(item.id, item);
      const page = { ...next, media: [...byId.values()] };
      remember(cacheKey, page);
      setSnapshot({ key: requestKey, page });
    } catch (thrown) {
      if (id === requestId.current)
        setErrorState({
          key: requestKey,
          message:
            thrown instanceof Error
              ? thrown.message
              : "Could not load more anime.",
        });
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [visible, loadingMore, requestOptions, remember, cacheKey, requestKey]);

  const add = useCallback(async (item: DiscoverMedia) => {
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
      setJustAdded((added) => new Set(added).add(item.id));
      setAddStates((states) => ({ ...states, [item.id]: "added" }));
    } catch (thrown) {
      setAddStates((states) => ({ ...states, [item.id]: "idle" }));
      setAddError(
        thrown instanceof Error ? thrown.message : "Could not add that title.",
      );
    }
  }, []);

  const open = useCallback(
    async (item: DiscoverMedia) => {
      try {
        const existing = await entryByMediaId(item.id);
        if (existing) {
          router.push({ pathname: "/anime/[id]", params: { id: existing.id } });
        } else {
          router.push({
            pathname: "/add-anime",
            params: { url: `https://anilist.co/anime/${item.id}` },
          });
        }
      } catch {
        setAddError("Could not open this anime. Try again.");
      }
    },
    [router],
  );

  const heading = trimmed
    ? "Search results"
    : mode === "season"
      ? `${season.label} ${season.year}`
      : mode === "airing"
        ? "Airing now"
        : mode === "upcoming"
          ? "Coming soon"
          : "Trending now";
  const count = visible?.pageInfo.total ?? 0;

  return (
    <Screen>
      <FlatList
        data={media}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <SearchResultCard
            media={item}
            inLibrary={isInLibrary(item.id)}
            addState={addStates[item.id] ?? "idle"}
            now={now}
            onAdd={() => void add(item)}
            onOpen={() => void open(item)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenTitle title="Discover" subtitle="Find what to watch next." />
            <Input
              value={query}
              onChangeText={setQuery}
              icon="search"
              placeholder="Search anime or paste a link"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Search anime on AniList"
              onSubmitEditing={() => {
                if (parsedLink)
                  router.push({
                    pathname: "/add-anime",
                    params: { url: trimmed },
                  });
              }}
            />

            {parsedLink ? (
              <Button
                label="Open anime link"
                onPress={() =>
                  router.push({
                    pathname: "/add-anime",
                    params: { url: trimmed },
                  })
                }
              />
            ) : null}

            {!trimmed ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.modeRow}
                >
                  <ChoiceChip
                    label="Season"
                    selected={mode === "season"}
                    onPress={() => setMode("season")}
                  />
                  <ChoiceChip
                    label="Airing"
                    selected={mode === "airing"}
                    onPress={() => setMode("airing")}
                  />
                  <ChoiceChip
                    label="Upcoming"
                    selected={mode === "upcoming"}
                    onPress={() => setMode("upcoming")}
                  />
                  <ChoiceChip
                    label="Trending"
                    selected={mode === "trending"}
                    onPress={() => setMode("trending")}
                  />
                </ScrollView>

                {mode === "season" ? (
                  <View style={styles.seasonRow}>
                    <Pressable
                      onPress={() => setSeasonOffset((value) => value - 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Previous anime season"
                      style={styles.seasonArrow}
                    >
                      <Feather
                        name="chevron-left"
                        size={22}
                        color={theme.color.foreground}
                      />
                    </Pressable>
                    <View style={styles.seasonCenter}>
                      <Text style={styles.seasonLabel}>
                        {season.label} {season.year}
                      </Text>
                      {seasonOffset !== 0 ? (
                        <Pressable
                          onPress={() => setSeasonOffset(0)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.seasonReset}>
                            Back to this season
                          </Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.seasonHint}>
                          This season’s anime
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => setSeasonOffset((value) => value + 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Next anime season"
                      style={styles.seasonArrow}
                    >
                      <Feather
                        name="chevron-right"
                        size={22}
                        color={theme.color.foreground}
                      />
                    </Pressable>
                  </View>
                ) : null}

                <Text style={styles.filterLabel}>FORMAT</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {FORMATS.map((option) => (
                    <ChoiceChip
                      key={option.value}
                      label={option.label}
                      selected={format === option.value}
                      onPress={() => setFormat(option.value)}
                    />
                  ))}
                </ScrollView>

                {mode !== "trending" ? (
                  <View style={styles.sortRow}>
                    <Text style={styles.filterLabel}>SORT</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filterRow}
                    >
                      {SORTS.map((option) => (
                        <ChoiceChip
                          key={option.value}
                          label={option.label}
                          selected={sort === option.value}
                          onPress={() => setSort(option.value)}
                          compact
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </>
            ) : null}

            <View style={styles.resultsHeading}>
              <Text accessibilityRole="header" style={styles.resultsTitle}>
                {heading}
              </Text>
              {!working && !error && !isLink ? (
                <Text style={styles.resultCount}>
                  {count.toLocaleString()} titles
                </Text>
              ) : null}
            </View>
            {addError ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {addError}
              </Text>
            ) : null}
            {error && visible ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          working ? (
            <EmptyState
              title="Finding anime"
              message="Loading this view from AniList…"
              icon="search"
            />
          ) : (
            <EmptyState
              title={
                error
                  ? "Couldn’t load anime"
                  : parsedLink
                    ? "Anime link ready"
                    : "No anime found"
              }
              message={
                error ??
                (parsedLink
                  ? "Open the link to preview this title."
                  : "Try another season, format or search.")
              }
              icon="search"
            >
              {error && !isLink ? (
                <Button
                  label="Try again"
                  variant="outline"
                  onPress={() => setAttempt((value) => value + 1)}
                />
              ) : null}
            </EmptyState>
          )
        }
        ListFooterComponent={
          visible?.pageInfo.hasNextPage ? (
            <Button
              label={
                error
                  ? "Retry loading more"
                  : loadingMore
                    ? "Loading…"
                    : "Show more anime"
              }
              variant="outline"
              busy={loadingMore}
              onPress={() => void loadMore()}
              style={styles.more}
            />
          ) : null
        }
      />
    </Screen>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        selected && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 36, gap: 12 },
  header: { gap: 16, paddingBottom: 4 },
  modeRow: { flexDirection: "row", gap: 8, paddingTop: 2 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  chipCompact: { minHeight: 40, paddingHorizontal: 14 },
  chipActive: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
  },
  chipLabel: { ...theme.type.label, color: theme.color.foreground },
  chipLabelActive: { color: theme.color.accentForeground },
  pressed: { opacity: 0.75 },
  seasonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
    borderRadius: 16,
    backgroundColor: theme.color.surfaceRaised,
  },
  seasonArrow: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  seasonCenter: { alignItems: "center", gap: 2 },
  seasonLabel: { ...theme.type.section, color: theme.color.foreground },
  seasonHint: { ...theme.type.caption, color: theme.color.muted },
  seasonReset: { ...theme.type.caption, color: theme.color.accent },
  filterLabel: {
    ...theme.type.caption,
    color: theme.color.muted,
    fontWeight: "700",
    letterSpacing: 1,
  },
  filterRow: { gap: 8, paddingRight: SCREEN_PADDING },
  sortRow: { gap: 8 },
  resultsHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },
  resultsTitle: {
    ...theme.type.section,
    color: theme.color.foreground,
    flexShrink: 1,
  },
  resultCount: { ...theme.type.caption, color: theme.color.muted },
  error: { ...theme.type.body, color: theme.color.danger },
  more: { marginTop: 8 },
});
