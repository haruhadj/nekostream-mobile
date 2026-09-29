import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { MAL_CONFIG_ERROR } from "@/auth/config";
import { useAuth } from "@/auth/context";
import { theme } from "@/theme";
import { Button } from "@/ui/button";
import { Screen, ScreenTitle, SCREEN_PADDING } from "@/ui/screen";

/**
 * The two tracker accounts, and the ways in and out of each.
 *
 * This replaces the server + session card: there is no server to name any
 * more, and no session — just AniList, which gates the app, and MyAnimeList,
 * which is optional and can be linked or dropped at any time. That asymmetry
 * is the same one the web app has, and it is deliberate: one tracker failing
 * never takes the other with it.
 *
 * The notification toggle and the Stremio addon are not coming here. Email
 * needs SMTP and Stremio needs an addon URL — both are the server's, and this
 * client no longer has one.
 */
export default function SettingsScreen() {
  const { anilist, mal, linkMal, unlinkMal, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectMal() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await linkMal();
    if (message) setError(message);
    setBusy(false);
  }

  function confirmUnlink() {
    Alert.alert(
      "Unlink MyAnimeList?",
      "Progress will stop syncing to MyAnimeList. Your AniList account and everything on this device stay as they are.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: () => void unlinkMal(),
        },
      ],
    );
  }

  function confirmSignOut() {
    Alert.alert(
      "Sign out?",
      "This clears both tracker logins from this device. The library, saved Nyaa filters and discovered episodes stay — signing back in picks them up.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => void signOut(),
        },
      ],
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Your space" subtitle="Your accounts, connected." />
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(anilist?.name ?? "N").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName}>
              {anilist?.name ?? "Anime fan"}
            </Text>
            <Text style={styles.profileDetail}>Your personal anime shelf</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Connected trackers</Text>

        <View style={styles.card}>
          <Account
            provider="AniList"
            tint={theme.color.anilist}
            name={anilist?.name ?? "Not signed in"}
            detail="Connected · Your watchlist and episode progress sync here."
          />

          <View style={styles.divider} />

          <Account
            provider="MyAnimeList"
            tint={theme.color.mal}
            name={mal?.name ?? "Not linked"}
            detail={
              mal
                ? "Connected · Keep both trackers up to date."
                : "Connect to sync episode progress to both lists."
            }
          />

          <View style={styles.cardActions}>
            {mal ? (
              <Button
                label="Unlink"
                variant="outline"
                size="sm"
                onPress={confirmUnlink}
              />
            ) : (
              <Button
                label="Link MyAnimeList"
                variant="outline"
                size="sm"
                busy={busy}
                disabled={!!MAL_CONFIG_ERROR}
                onPress={() => void connectMal()}
              />
            )}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {MAL_CONFIG_ERROR ? (
          <Text style={styles.hint}>{MAL_CONFIG_ERROR}</Text>
        ) : null}

        <Text style={styles.sectionLabel}>On this device</Text>
        <View style={styles.localInfo}>
          <Feather name="smartphone" color={theme.color.accent} size={22} />
          <Text style={styles.localText}>
            Your library, episode feeds, and discovered releases are saved on
            this phone.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button label="Sign out" variant="ghost" onPress={confirmSignOut} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Account({
  provider,
  tint,
  name,
  detail,
}: {
  provider: string;
  tint: string;
  name: string;
  detail: string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.providerRow}>
        <View style={[styles.dot, { backgroundColor: tint }]} />
        <Text style={styles.fieldLabel}>{provider}</Text>
      </View>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.fieldDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.color.accentContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...theme.type.headline, color: theme.color.accent },
  profileText: { flex: 1, gap: 4 },
  profileName: { ...theme.type.title, color: theme.color.foreground },
  profileDetail: { ...theme.type.caption, color: theme.color.muted },
  localInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  localText: { ...theme.type.body, color: theme.color.muted, flex: 1 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32 },
  sectionLabel: {
    marginTop: 28,
    marginBottom: 12,
    color: theme.color.muted,
    ...theme.type.section,
  },
  card: {
    borderRadius: 12,
    backgroundColor: theme.color.surface,
  },
  divider: { height: 1, backgroundColor: theme.color.border },
  field: { paddingHorizontal: 20, paddingVertical: 20, gap: 6 },
  providerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fieldLabel: { color: theme.color.muted, fontSize: 12 },
  fieldValue: {
    color: theme.color.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  fieldDetail: { color: theme.color.muted, fontSize: 12, lineHeight: 17 },
  cardActions: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    alignItems: "flex-start",
  },
  error: { marginTop: 12, color: theme.color.danger, fontSize: 13 },
  hint: {
    marginTop: 12,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  actions: { marginTop: 20, gap: 10 },
});
