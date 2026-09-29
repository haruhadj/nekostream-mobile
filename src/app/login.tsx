import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ANILIST_CONFIG_ERROR } from "@/auth/config";
import { useAuth } from "@/auth/context";
import { theme } from "@/theme";
import { Wordmark } from "@/ui/wordmark";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(ANILIST_CONFIG_ERROR);
  const [busy, setBusy] = useState(false);
  async function connect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await signIn();
    if (message) setError(message);
    setBusy(false);
  }
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Wordmark />
        <View style={styles.intro}>
          <Text style={styles.title}>
            Your anime.{"\n"}
            <Text style={styles.titleAccent}>Your pace.</Text>
          </Text>
          <Text style={styles.subtitle}>
            One home for your watchlist, your next episode, and everything you
            want to watch.
          </Text>
        </View>
        <View style={styles.features}>
          {(
            [
              [
                "book-open",
                "Your library, together",
                "Bring your AniList watchlist along.",
              ],
              [
                "calendar",
                "Never lose your place",
                "Track progress and see what’s airing next.",
              ],
              [
                "download",
                "Episodes within reach",
                "Find releases with your own Nyaa preferences.",
              ],
            ] as const
          ).map(([icon, title, detail]) => (
            <View key={title} style={styles.feature}>
              <Feather name={icon} size={22} color={theme.color.accent} />
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDetail}>{detail}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.connect}>
          <Pressable
            style={[
              styles.button,
              (busy || !!ANILIST_CONFIG_ERROR) && styles.buttonBusy,
            ]}
            onPress={() => void connect()}
            disabled={busy || !!ANILIST_CONFIG_ERROR}
            accessibilityRole="button"
            accessibilityState={{
              disabled: busy || !!ANILIST_CONFIG_ERROR,
              busy,
            }}
          >
            {busy ? (
              <ActivityIndicator color={theme.color.accentForeground} />
            ) : (
              <>
                <Text style={styles.buttonText}>Continue with AniList</Text>
                <Feather
                  name="arrow-right"
                  size={20}
                  color={theme.color.accentForeground}
                />
              </>
            )}
          </Pressable>
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Text style={styles.footerText}>
            Your library lives on this device. You can connect MyAnimeList
            later.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  inner: { flexGrow: 1, padding: 28, paddingTop: 24, gap: 24 },
  intro: { marginTop: 36, gap: 16 },
  title: {
    color: theme.color.foreground,
    fontSize: 44,
    fontWeight: "800",
    lineHeight: 52,
    letterSpacing: -1.2,
  },
  titleAccent: { color: theme.color.accent },
  subtitle: {
    ...theme.type.body,
    color: theme.color.muted,
    fontSize: 16,
    lineHeight: 25,
  },
  features: { gap: 24, marginVertical: 20 },
  feature: { flexDirection: "row", alignItems: "center", gap: 16 },
  featureBody: { flex: 1, gap: 4 },
  featureTitle: {
    ...theme.type.label,
    color: theme.color.foreground,
    fontSize: 15,
  },
  featureDetail: { ...theme.type.caption, color: theme.color.muted },
  connect: { marginTop: "auto", gap: 14, paddingTop: 16 },
  button: {
    minHeight: 56,
    backgroundColor: theme.color.accent,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  buttonBusy: { opacity: 0.6 },
  buttonText: {
    color: theme.color.accentForeground,
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  error: { ...theme.type.body, color: theme.color.danger },
  footerText: {
    ...theme.type.caption,
    color: theme.color.muted,
    textAlign: "center",
  },
});
