/**
 * The saved Nyaa feed, collapsed to a summary — the port of the web's
 * `nyaa-filter-panel.tsx`.
 *
 * With no saved feed the setup form opens immediately, which is the whole
 * point of the flow: an anime that has just been added should be one screen
 * away from an episode list, not two.
 */

import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { SavedFilter } from "@shared/nyaa/filter";

import { NyaaFilterSetup } from "@/components/nyaa-filter-setup";
import { theme } from "@/theme";
import { Button } from "@/ui/button";

function nyaaUrl(filter: SavedFilter): string {
  return `https://nyaa.si/?q=${encodeURIComponent(filter.query)}&c=${filter.category}&f=${filter.filter}`;
}

export function NyaaFilterPanel({
  defaultTitle,
  savedFilter,
  onSave,
  onRemove,
}: {
  defaultTitle: string;
  savedFilter: SavedFilter | null;
  onSave: (filter: SavedFilter) => Promise<string | null>;
  onRemove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (!editing && !savedFilter) {
    return (
      <View style={styles.card}>
        <Text style={styles.queryTitle}>Find episode releases</Text>
        <Text style={styles.helper}>
          Choose a release group and quality to find this anime on Nyaa.
        </Text>
        <Button
          label="Set up episode feed"
          variant="outline"
          onPress={() => setEditing(true)}
        />
      </View>
    );
  }

  if (editing) {
    return (
      <NyaaFilterSetup
        defaultTitle={defaultTitle}
        savedFilter={savedFilter}
        onSave={async (filter) => {
          const error = await onSave(filter);
          if (!error) setEditing(false);
          return error;
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (!savedFilter) return null;

  function confirmRemove() {
    // The web's `confirm()`, with the destructive styling a phone expects.
    Alert.alert(
      "Stop tracking Nyaa?",
      "Episodes already found stay in the list, but nothing new will be fetched until a feed is set up again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop tracking",
          style: "destructive",
          onPress: () => {
            setRemoving(true);
            void onRemove()
              .catch(() =>
                Alert.alert(
                  "Could not stop tracking",
                  "The feed is still saved. Try again.",
                ),
              )
              .finally(() => setRemoving(false));
          },
        },
      ],
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.queryTitle}>Episode feed</Text>
      <Text style={styles.query} numberOfLines={2}>
        {savedFilter.query}
      </Text>

      <View style={styles.actions}>
        <Button
          label="Change feed"
          variant="outline"
          size="sm"
          onPress={() => setEditing(true)}
        />
        <Button
          label={removing ? "Removing…" : "Stop tracking"}
          variant="ghost"
          size="sm"
          busy={removing}
          onPress={confirmRemove}
        />
        <Pressable
          style={styles.externalLink}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(nyaaUrl(savedFilter))}
        >
          <Text style={styles.link}>Open on Nyaa</Text>
          <Feather name="external-link" size={14} color={theme.color.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  queryTitle: { ...theme.type.section, color: theme.color.foreground },
  helper: { ...theme.type.body, color: theme.color.muted, marginBottom: 8 },
  externalLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    padding: 16,
    gap: 6,
  },
  label: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  query: {
    color: theme.color.foreground,
    fontSize: 12,
    lineHeight: 20,
  },
  actions: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  link: { color: theme.color.muted, fontSize: 12, fontWeight: "600" },
});
