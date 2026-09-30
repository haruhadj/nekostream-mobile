import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { NyaaSearch } from "@/components/nyaa-search";
import { useQuery } from "@/data/use-query";
import { entryById } from "@/db/library";
import { theme } from "@/theme";
import { Screen, ScreenLoading, SCREEN_PADDING } from "@/ui/screen";

export default function NyaaSearchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const load = useCallback(() => entryById(id), [id]);
  const { data: entry, loading } = useQuery(load, "Could not load this anime.");

  if (loading) {
    return (
      <Screen>
        <ScreenLoading />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to anime"
          style={styles.back}
        >
          <Feather name="arrow-left" size={20} color={theme.color.foreground} />
          <Text style={styles.backLabel}>Back to anime</Text>
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>MANUAL RELEASE SEARCH</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Search Nyaa
          </Text>
        </View>

        {entry ? (
          <>
            <View style={styles.anime}>
              <Image
                source={
                  entry.coverImageUrl ? { uri: entry.coverImageUrl } : null
                }
                style={styles.poster}
                contentFit="cover"
                cachePolicy="disk"
              />
              <View style={styles.animeText}>
                <Text style={styles.animeTitle} numberOfLines={2}>
                  {entry.titleEnglish ?? entry.titleRomaji}
                </Text>
                {entry.titleEnglish &&
                entry.titleEnglish !== entry.titleRomaji ? (
                  <Text style={styles.romaji} numberOfLines={2}>
                    {entry.titleRomaji}
                  </Text>
                ) : null}
              </View>
            </View>
            <NyaaSearch
              key={entry.id}
              english={entry.titleEnglish}
              romaji={entry.titleRomaji}
            />
          </>
        ) : (
          <Text style={styles.missing}>That title is not in your library.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SCREEN_PADDING, paddingBottom: 44, gap: 22 },
  back: {
    minHeight: 48,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backLabel: { ...theme.type.label, color: theme.color.foreground },
  heading: { gap: 6 },
  eyebrow: {
    ...theme.type.caption,
    color: theme.color.accent,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: { ...theme.type.headline, color: theme.color.foreground },
  anime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: theme.color.surface,
  },
  poster: {
    width: 56,
    height: 84,
    borderRadius: 8,
    backgroundColor: theme.color.surfaceRaised,
  },
  animeText: { flex: 1, gap: 6 },
  animeTitle: { ...theme.type.section, color: theme.color.foreground },
  romaji: { ...theme.type.caption, color: theme.color.muted },
  missing: { ...theme.type.body, color: theme.color.muted },
});
