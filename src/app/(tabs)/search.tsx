import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const BROWSE_MODES: {
  value: BrowseMode;
  label: string;
  detail: string;
  icon: ComponentProps<typeof Feather>["name"];
}[] = [
  { value: "season", label: "Season", detail: "Browse a release season", icon: "calendar" },
  { value: "airing", label: "Airing", detail: "Shows releasing now", icon: "radio" },
  { value: "upcoming", label: "Upcoming", detail: "Find what starts next", icon: "clock" },
  { value: "trending", label: "Trending", detail: "Popular on AniList", icon: "trending-up" },
];

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
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(340, windowWidth - 40);
  const drawerX = useRef(new Animated.Value(-360)).current;
  const now = useNow();
  const [baseSeason] = useState(() => {
    const date = new Date();
    return date.getFullYear() * 4 + Math.floor(date.getMonth() / 3);
  });
  const [seasonOffset, setSeasonOffset] = useState(0);
  const [mode, setMode] = useState<BrowseMode>("season");
  const [format, setFormat] = useState<DiscoverFormat>("all");
  const [sort, setSort] = useState<DiscoverSort>("POPULARITY_DESC");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<BrowseMode>("season");
  const [draftFormat, setDraftFormat] = useState<DiscoverFormat>("all");
  const [draftSort, setDraftSort] = useState<DiscoverSort>("POPULARITY_DESC");
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
  const filterActive = format !== "all" || sort !== "POPULARITY_DESC";
  const openDrawer = () => {
    setDraftMode(mode);
    setDraftFormat(format);
    setDraftSort(sort);
    drawerX.setValue(-drawerWidth);
    setDrawerOpen(true);
    Animated.timing(drawerX, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  const closeDrawer = () => {
    Animated.timing(drawerX, {
      toValue: -drawerWidth,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDrawerOpen(false);
    });
  };
  const applyDrawer = () => {
    setMode(draftMode);
    setFormat(draftFormat);
    setSort(draftSort);
    closeDrawer();
  };

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
            <ScreenTitle
              title="Discover"
              trailing={!trimmed ? (
                <Pressable
                  onPress={openDrawer}
                  accessibilityRole="button"
                  accessibilityLabel="Open Discover menu"
                  style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
                >
                  <Feather name="menu" size={24} color={theme.color.foreground} />
                  {filterActive || mode !== "season" ? <View style={styles.menuDot} /> : null}
                </Pressable>
              ) : null}
            />
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

            <View style={styles.browseToolbar}>
              {mode === "season" && !trimmed ? (
                <View style={styles.seasonNavigation}>
                  <Pressable
                    onPress={() => setSeasonOffset((value) => value - 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Previous anime season"
                    style={styles.seasonArrow}
                  >
                    <Feather name="chevron-left" size={22} color={theme.color.foreground} />
                  </Pressable>
                  <Text accessibilityRole="header" style={styles.resultsTitle} numberOfLines={1}>
                    {heading}
                  </Text>
                  <Pressable
                    onPress={() => setSeasonOffset((value) => value + 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Next anime season"
                    style={styles.seasonArrow}
                  >
                    <Feather name="chevron-right" size={22} color={theme.color.foreground} />
                  </Pressable>
                </View>
              ) : (
                <Text accessibilityRole="header" style={styles.resultsTitle} numberOfLines={1}>
                  {heading}
                </Text>
              )}
            </View>
            {!trimmed && (format !== "all" || (sort !== "POPULARITY_DESC" && mode !== "trending")) ? (
              <Text style={styles.activeFilters}>
                {[format !== "all" ? FORMATS.find((item) => item.value === format)?.label : null,
                  sort !== "POPULARITY_DESC" && mode !== "trending"
                    ? SORTS.find((item) => item.value === sort)?.label
                    : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
            {seasonOffset !== 0 && mode === "season" && !trimmed ? (
              <Pressable
                onPress={() => setSeasonOffset(0)}
                accessibilityRole="button"
                style={styles.currentSeason}
              >
                <Text style={styles.currentSeasonText}>Return to this season</Text>
              </Pressable>
            ) : null}
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
      <Modal
        transparent
        visible={drawerOpen}
        animationType="none"
        onRequestClose={closeDrawer}
      >
        <View style={styles.drawerOverlay}>
          <Pressable
            onPress={closeDrawer}
            accessibilityRole="button"
            accessibilityLabel="Close Discover menu"
            style={styles.drawerScrim}
          />
          <Animated.View
            style={[
              styles.drawer,
              {
                width: drawerWidth,
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 12,
                transform: [{ translateX: drawerX }],
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Text accessibilityRole="header" style={styles.drawerTitle}>
                Discover menu
              </Text>
              <Pressable
                onPress={closeDrawer}
                accessibilityRole="button"
                accessibilityLabel="Close Discover menu"
                style={styles.drawerClose}
              >
                <Feather name="x" size={22} color={theme.color.foreground} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.drawerScroll}
              contentContainerStyle={styles.drawerContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.drawerSection}>Browse</Text>
              {BROWSE_MODES.map((option) => (
                <DrawerRow
                  key={option.value}
                  label={option.label}
                  detail={option.detail}
                  icon={option.icon}
                  selected={draftMode === option.value}
                  onPress={() => setDraftMode(option.value)}
                />
              ))}
              <View style={styles.drawerDivider} />
              <Text style={styles.drawerSection}>Format</Text>
              <View style={styles.drawerChips}>
                {FORMATS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    label={option.label}
                    selected={draftFormat === option.value}
                    onPress={() => setDraftFormat(option.value)}
                  />
                ))}
              </View>
              {draftMode !== "trending" ? (
                <>
                  <View style={styles.drawerDivider} />
                  <Text style={styles.drawerSection}>Sort by</Text>
                  {SORTS.map((option) => (
                    <DrawerRow
                      key={option.value}
                      label={option.label}
                      selected={draftSort === option.value}
                      onPress={() => setDraftSort(option.value)}
                    />
                  ))}
                </>
              ) : null}
            </ScrollView>
            <View style={styles.drawerFooter}>
              <Button label="Show anime" onPress={applyDrawer} />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </Screen>
  );
}

function DrawerRow({
  label,
  detail,
  icon,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  icon?: ComponentProps<typeof Feather>["name"];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.drawerRow,
        selected && styles.drawerRowSelected,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={20}
          color={selected ? theme.color.accent : theme.color.muted}
        />
      ) : null}
      <View style={styles.drawerRowText}>
        <Text style={styles.drawerRowLabel}>{label}</Text>
        {detail ? <Text style={styles.drawerRowDetail}>{detail}</Text> : null}
      </View>
      {selected ? <Feather name="check" size={18} color={theme.color.accent} /> : null}
    </Pressable>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
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
  header: { gap: 12, paddingBottom: 4 },
  menuButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: theme.color.surface,
  },
  menuDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.color.accent,
  },
  chip: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  chipActive: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
  },
  chipLabel: { ...theme.type.label, color: theme.color.foreground },
  chipLabelActive: { color: theme.color.accentForeground },
  pressed: { opacity: 0.75 },
  browseToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  seasonNavigation: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  seasonArrow: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  currentSeason: { minHeight: 48, alignSelf: "flex-start", justifyContent: "center" },
  currentSeasonText: { ...theme.type.label, color: theme.color.accent },
  activeFilters: { ...theme.type.caption, color: theme.color.accent, paddingLeft: 48 },
  resultsTitle: {
    ...theme.type.section,
    color: theme.color.foreground,
    flexShrink: 1,
  },
  drawerOverlay: { flex: 1 },
  drawerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
  },
  drawer: {
    height: "100%",
    backgroundColor: theme.color.surfaceRaised,
    elevation: 16,
  },
  drawerHeader: {
    minHeight: 56,
    paddingLeft: 20,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  drawerTitle: { ...theme.type.title, color: theme.color.foreground },
  drawerClose: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerScroll: { flex: 1 },
  drawerContent: { paddingHorizontal: 16, paddingBottom: 20, gap: 6 },
  drawerSection: {
    ...theme.type.label,
    color: theme.color.muted,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  drawerRow: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  drawerRowSelected: { backgroundColor: theme.color.accentContainer },
  drawerRowText: { flex: 1, minWidth: 0 },
  drawerRowLabel: { ...theme.type.label, color: theme.color.foreground },
  drawerRowDetail: { ...theme.type.caption, color: theme.color.muted },
  drawerDivider: {
    height: 1,
    backgroundColor: theme.color.border,
    marginHorizontal: 12,
    marginTop: 12,
  },
  drawerChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 8 },
  drawerFooter: { paddingHorizontal: 20, paddingTop: 12 },
  error: { ...theme.type.body, color: theme.color.danger },
  more: { marginTop: 8 },
});
