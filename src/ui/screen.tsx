import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";
import { Wordmark } from "@/ui/wordmark";

export const SCREEN_PADDING = 20;

export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>{children}</View>
  );
}

export function ScreenTitle({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <View style={styles.appBar}>
        <Wordmark />
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Your accounts and settings"
          style={({ pressed }) => [styles.account, pressed && styles.pressed]}
        >
          <Feather name="user" size={20} color={theme.color.accent} />
        </Pressable>
      </View>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {trailing}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionHeading({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

export function ScreenLoading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.color.accent} />
      <Text style={styles.loadingText}>Loading your anime…</Text>
    </View>
  );
}

export function EmptyState({
  message,
  children,
  title = "Nothing here yet",
  icon = "film",
}: {
  message: string;
  children?: ReactNode;
  title?: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={32} color={theme.color.accent} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {children ? <View style={styles.emptyAction}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: { ...theme.type.body, color: theme.color.muted },
  header: { paddingTop: 4, paddingBottom: 8 },
  appBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  account: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: theme.color.surface,
  },
  pressed: { opacity: 0.7 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    ...theme.type.headline,
    color: theme.color.foreground,
    flexShrink: 1,
  },
  subtitle: { ...theme.type.body, marginTop: 6, color: theme.color.muted },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    ...theme.type.section,
    color: theme.color.foreground,
    flexShrink: 1,
  },
  empty: {
    marginTop: 28,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    ...theme.type.section,
    color: theme.color.foreground,
    textAlign: "center",
  },
  emptyText: {
    ...theme.type.body,
    color: theme.color.muted,
    textAlign: "center",
    maxWidth: 300,
  },
  emptyAction: { marginTop: 8 },
});
