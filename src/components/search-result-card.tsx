import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DiscoverMedia } from "@/data/discover";
import { formatGap } from "@/hooks/use-now";
import { theme } from "@/theme";
import { Button } from "@/ui/button";

export type AddState = "idle" | "adding" | "added";

export function SearchResultCard({
  media,
  inLibrary,
  addState,
  now,
  onAdd,
  onOpen,
}: {
  media: DiscoverMedia;
  inLibrary: boolean;
  addState: AddState;
  now: number;
  onAdd: () => void;
  onOpen: () => void;
}) {
  const nextAiring = media.nextAiringEpisode;
  const remaining = nextAiring ? nextAiring.airingAt * 1_000 - now : null;
  const airingLabel =
    remaining !== null && remaining > 0
      ? `Ep ${nextAiring!.episode} in ${formatGap(remaining, { short: true })}`
      : media.status === "NOT_YET_RELEASED"
        ? "Upcoming"
        : media.status === "RELEASING"
          ? "Airing"
          : null;
  const meta = [
    media.format?.replace(/_/g, " "),
    media.seasonYear,
    media.episodes ? `${media.episodes} eps` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`View ${media.title.english ?? media.title.romaji}`}
        style={({ pressed }) => [styles.posterTap, pressed && styles.pressed]}
      >
        <Image
          source={
            media.coverImage?.large ? { uri: media.coverImage.large } : null
          }
          style={styles.poster}
          contentFit="cover"
          cachePolicy="disk"
        />
      </Pressable>

      <View style={styles.body}>
        <View style={styles.topLine}>
          {airingLabel ? (
            <Text style={styles.airing}>{airingLabel}</Text>
          ) : null}
          {media.averageScore ? (
            <Text style={styles.score}>{media.averageScore}%</Text>
          ) : null}
        </View>
        <Pressable onPress={onOpen} accessibilityRole="button">
          <Text style={styles.title} numberOfLines={2}>
            {media.title.english ?? media.title.romaji}
          </Text>
        </Pressable>
        {media.title.english && media.title.english !== media.title.romaji ? (
          <Text style={styles.romaji} numberOfLines={1}>
            {media.title.romaji}
          </Text>
        ) : null}
        <Text style={styles.meta} numberOfLines={1}>
          {meta || "Anime"}
        </Text>
        {media.genres?.length ? (
          <Text style={styles.genres} numberOfLines={1}>
            {media.genres.slice(0, 2).join(" · ")}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button
            label={inLibrary ? "In library" : "Add"}
            variant={inLibrary ? "outline" : "primary"}
            size="sm"
            onPress={onAdd}
            disabled={inLibrary}
            busy={addState === "adding"}
            style={styles.add}
          />
          <Button
            label={inLibrary ? "Open" : "Details"}
            variant="ghost"
            size="sm"
            onPress={onOpen}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: theme.color.surface,
  },
  posterTap: { width: 96, alignSelf: "stretch" },
  poster: {
    width: "100%",
    height: "100%",
    minHeight: 150,
    borderRadius: 10,
    backgroundColor: theme.color.surfaceRaised,
  },
  body: { flex: 1, minWidth: 0, gap: 4 },
  topLine: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  airing: {
    ...theme.type.caption,
    color: theme.color.accent,
    fontWeight: "700",
  },
  score: {
    ...theme.type.caption,
    color: theme.color.amberText,
    fontWeight: "700",
  },
  title: { ...theme.type.label, color: theme.color.foreground, fontSize: 15 },
  romaji: { ...theme.type.caption, color: theme.color.muted },
  meta: { ...theme.type.caption, color: theme.color.muted },
  genres: { ...theme.type.caption, color: theme.color.muted },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: "auto",
    gap: 4,
  },
  add: { minWidth: 96 },
  pressed: { opacity: 0.75 },
});
