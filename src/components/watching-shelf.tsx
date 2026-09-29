import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { LibraryEntryRow } from "@/db/library";
import { theme } from "@/theme";
import { SectionHeading, SCREEN_PADDING } from "@/ui/screen";

export function WatchingShelf({ entries }: { entries: LibraryEntryRow[] }) {
  const router = useRouter();
  const watching = entries
    .filter(
      (entry) =>
        ["CURRENT", "REPEATING"].includes(entry.anilistStatus ?? "") &&
        (!entry.totalEpisodes || entry.progress < entry.totalEpisodes),
    )
    .slice(0, 8);
  if (!watching.length) return null;
  return (
    <View>
      <SectionHeading title="Continue watching" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.items}
      >
        {watching.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            accessibilityLabel={`Continue ${entry.titleEnglish ?? entry.titleRomaji}, ${entry.progress} episodes watched`}
            onPress={() =>
              router.push({ pathname: "/anime/[id]", params: { id: entry.id } })
            }
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Image
              source={entry.coverImageUrl ? { uri: entry.coverImageUrl } : null}
              style={styles.cover}
              contentFit="cover"
              cachePolicy="disk"
              accessible={false}
            />
            <View style={styles.body}>
              <Text numberOfLines={2} style={styles.title}>
                {entry.titleEnglish ?? entry.titleRomaji}
              </Text>
              <Text style={styles.progress}>
                {entry.progress}
                {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""} watched
              </Text>
              <View style={styles.next}>
                <Feather name="play" size={13} color={theme.color.accent} />
                <Text style={styles.nextText}>
                  Episode {entry.progress + 1}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  scroll: { marginHorizontal: -SCREEN_PADDING },
  items: { paddingHorizontal: SCREEN_PADDING, gap: 12 },
  card: {
    width: 254,
    padding: 10,
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    backgroundColor: theme.color.surface,
  },
  cover: {
    width: 64,
    height: 96,
    borderRadius: 8,
    backgroundColor: theme.color.surfaceRaised,
  },
  body: { flex: 1, justifyContent: "center", gap: 5 },
  title: { ...theme.type.label, color: theme.color.foreground },
  progress: { ...theme.type.caption, color: theme.color.muted },
  next: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  nextText: {
    ...theme.type.caption,
    color: theme.color.accent,
    fontWeight: "600",
  },
  pressed: { opacity: 0.7 },
});
