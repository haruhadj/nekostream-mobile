/**
 * One anime: what the device knows, plus what AniList says about it.
 *
 * Everything that writes lives here — the progress stepper (both trackers, in
 * parallel), the saved Nyaa feed, and the episode list the feed produces. It
 * is the phone's version of the web's `/anime/[id]` page, and the reason the
 * app is worth having on a phone at all: the magnet button.
 */

import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { mediaById, type AniListMedia } from "@shared/anilist/queries";
import type { SavedFilter } from "@shared/nyaa/filter";

import { AiringBadge } from "@/components/airing-badge";
import { EpisodeList } from "@/components/episode-list";
import { NyaaFilterPanel } from "@/components/nyaa-filter-panel";
import { NyaaSearch } from "@/components/nyaa-search";
import { ProgressControl } from "@/components/progress-control";
import { TrackerEditors } from "@/components/tracker-editor";
import { TrackerLinks } from "@/components/tracker-links";
import { useQuery } from "@/data/use-query";
import { entryById } from "@/db/library";
import {
  deleteFilter,
  getFilter,
  listEpisodes,
  saveFilter,
  type EpisodeRow,
  type RssFilterRow,
} from "@/db/nyaa";
import { useAuth } from "@/auth/context";
import { useNow } from "@/hooks/use-now";
import { tickProgress, type SyncOutcome } from "@/sync/progress";
import { refreshEpisodes } from "@/sync/refresh";
import { theme } from "@/theme";
import { Screen, ScreenLoading, SCREEN_PADDING } from "@/ui/screen";

export default function AnimeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const now = useNow();
  const [section, setSection] = useState<"episodes" | "about">("episodes");
  const { mal } = useAuth();

  const load = useCallback(() => entryById(id), [id]);
  const {
    data: entry,
    loading,
    setData,
    reload,
  } = useQuery(load, "Not found.");

  // AniList's own copy — description, genres, score. Fetched separately
  // because none of it is worth storing per entry (see viewerLibrary's own
  // note on why the import keeps only what the library renders).
  const [media, setMedia] = useState<AniListMedia | null>(null);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;

    void (async () => {
      try {
        const found = await mediaById(entry.anilistMediaId);
        if (!cancelled) setMedia(found);
      } catch {
        // Advisory only: the screen's own data is already on it.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entry]);

  const onChange = useCallback(
    async (next: number): Promise<SyncOutcome[]> => {
      if (!entry) return [];
      const result = await tickProgress(entry, next);
      // The local write already happened; show it whatever the trackers did.
      if (result.entry) setData(result.entry);
      return result.outcomes;
    },
    [entry, setData],
  );

  /* ---------------------------------------------------------------- *
   * Nyaa
   * ---------------------------------------------------------------- */

  const [filter, setFilter] = useState<RssFilterRow | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [marking, setMarking] = useState(false);

  const reloadNyaa = useCallback(async () => {
    const [saved, rows] = await Promise.all([getFilter(id), listEpisodes(id)]);
    setFilter(saved);
    setEpisodes(rows);
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [saved, rows] = await Promise.all([
        getFilter(id),
        listEpisodes(id),
      ]);
      if (cancelled) return;
      setFilter(saved);
      setEpisodes(rows);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const onSaveFilter = useCallback(
    async (values: SavedFilter): Promise<string | null> => {
      await saveFilter(id, values);

      // Populate the list straight away: a feed saved with nothing behind it
      // looks broken. A failure here is worth saying out loud — the feed did
      // save, and the list will stay empty until a manual refresh.
      let message: string | null = null;
      try {
        await refreshEpisodes(id);
      } catch (thrown) {
        message =
          thrown instanceof Error
            ? `Saved, but: ${thrown.message}`
            : "Saved, but could not load episodes yet.";
      }

      await reloadNyaa();
      return message;
    },
    [id, reloadNyaa],
  );

  const onRemoveFilter = useCallback(async () => {
    await deleteFilter(id);
    await reloadNyaa();
  }, [id, reloadNyaa]);

  const onRefreshEpisodes = useCallback(async (): Promise<string> => {
    try {
      const { added } = await refreshEpisodes(id);
      await reloadNyaa();
      return added === 0
        ? "No new episodes."
        : `Added ${added} new ${added === 1 ? "release" : "releases"}.`;
    } catch (thrown) {
      return thrown instanceof Error ? thrown.message : "Refresh failed.";
    }
  }, [id, reloadNyaa]);

  const onMarkWatched = useCallback(
    async (next: number) => {
      setMarking(true);
      try {
        await onChange(next);
      } finally {
        setMarking(false);
      }
    },
    [onChange],
  );

  if (loading) {
    return (
      <Screen>
        <ScreenLoading />
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={styles.missingText}>
            That title is not in your library.
          </Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{ title: entry.titleEnglish ?? entry.titleRomaji }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <Feather name="arrow-left" size={20} color={theme.color.foreground} />
          <Text style={styles.link}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.posterFrame}>
            <Image
              source={entry.coverImageUrl ? { uri: entry.coverImageUrl } : null}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="disk"
              transition={120}
            />
            {entry.nextAiringAt && entry.nextAiringEpisode ? (
              <AiringBadge
                episodeNumber={entry.nextAiringEpisode}
                airingAt={entry.nextAiringAt}
                now={now}
              />
            ) : null}
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              {entry.titleEnglish ?? entry.titleRomaji}
            </Text>
            {entry.titleEnglish && entry.titleEnglish !== entry.titleRomaji ? (
              <Text style={styles.subtitle}>{entry.titleRomaji}</Text>
            ) : null}
            <Text style={styles.meta}>
              {[
                media?.format,
                media?.seasonYear ? String(media.seasonYear) : null,
                entry.totalEpisodes ? `${entry.totalEpisodes} episodes` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>

        <View style={styles.controls}>
          <Text style={styles.progressHeading}>Your progress</Text>
          {entry.totalEpisodes ? (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(entry.progress / entry.totalEpisodes, 1) * 100}%`,
                  },
                ]}
              />
            </View>
          ) : null}
          <ProgressControl
            progress={entry.progress}
            totalEpisodes={entry.totalEpisodes}
            onChange={onChange}
          />
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {(["episodes", "about"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setSection(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === tab }}
              style={[styles.tab, section === tab && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  section === tab && styles.tabLabelActive,
                ]}
              >
                {tab === "episodes" ? "Episodes" : "About & trackers"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={section === "episodes" ? undefined : { display: "none" }}>
          <NyaaSearch
            key={entry.id}
            english={entry.titleEnglish}
            romaji={entry.titleRomaji}
          />
        </View>

        {section === "episodes" ? (
          <>
            <EpisodeList
              episodes={episodes}
              progress={entry.progress}
              lastFetchedAt={filter?.lastFetchedAt ?? null}
              hasFilter={filter !== null}
              busy={marking}
              onRefresh={onRefreshEpisodes}
              onMarkWatched={onMarkWatched}
            />
            <NyaaFilterPanel
              defaultTitle={entry.titleRomaji}
              savedFilter={filter}
              onSave={onSaveFilter}
              onRemove={onRemoveFilter}
            />
          </>
        ) : (
          <>
            {media?.genres?.length ? (
              <Text style={styles.genres}>{media.genres.join(" · ")}</Text>
            ) : null}
            {media?.description ? (
              <Text style={styles.description}>
                {stripHtml(media.description)}
              </Text>
            ) : (
              <Text style={styles.subtitle}>
                A synopsis will appear when anime details are available.
              </Text>
            )}
            <Text style={styles.progressHeading}>Manage your trackers</Text>
            <Text style={styles.subtitle}>
              Update status, score, and sync preferences.
            </Text>
            <TrackerEditors
              entry={entry}
              malLinked={mal !== null}
              onSaved={() => void reload()}
            />
            <TrackerLinks
              anilistMediaId={entry.anilistMediaId}
              malMediaId={entry.malMediaId}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * AniList returns descriptions with `asHtml: false`, which still leaves `<br>`
 * and the odd `<i>` in the text. React Native renders neither, so they are
 * flattened rather than shown as literal markup.
 */
function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

const styles = StyleSheet.create({
  progressHeading: { ...theme.type.section, color: theme.color.foreground },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.color.border,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: theme.color.accent },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: theme.color.surface,
  },
  tabActive: { backgroundColor: theme.color.accentContainer },
  tabLabel: { ...theme.type.label, color: theme.color.muted },
  tabLabelActive: { color: theme.color.accent },
  controls: {
    gap: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.color.surface,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 20,
  },
  back: {
    alignSelf: "flex-start",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 16,
  },
  link: { color: theme.color.foreground, fontSize: 14, fontWeight: "600" },
  header: { flexDirection: "row", gap: 16 },
  posterFrame: {
    width: 104,
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: theme.color.surface,
  },
  poster: { width: "100%", height: "100%" },
  headerText: { flex: 1, gap: 6 },
  title: {
    color: theme.color.foreground,
    ...theme.type.title,
  },
  subtitle: { color: theme.color.muted, fontSize: 13, lineHeight: 18 },
  meta: { color: theme.color.muted, fontSize: 12 },
  pressed: { opacity: 0.75 },
  genres: { color: theme.color.muted, fontSize: 12 },
  description: {
    color: theme.color.foreground,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.9,
  },
  pending: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.color.border,
    padding: 18,
  },
  pendingText: {
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  missingText: { color: theme.color.muted, fontSize: 14 },
});
