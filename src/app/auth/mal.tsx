/**
 * The MyAnimeList redirect target. Exists for the same reason as
 * `anilist.tsx` — see that file for what the device showed without it.
 *
 * Linking MAL happens from Settings and leaves the app on the tabs, so "/" is
 * where this belongs too; the gate routes on from there.
 */

import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/auth/context";
import { theme } from "@/theme";

export default function MalRedirect() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "ready") router.replace("/(tabs)");
    if (status === "no-tracker") router.replace("/login");
  }, [router, status]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={theme.color.accent} />
    </View>
  );
}
