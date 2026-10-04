import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SETTINGS_CATEGORIES,
  type Setting,
  type SettingsCategory,
} from "@/settings/catalog";
import {
  DEFAULT_PREFERENCES,
  savePreferences,
  usePreferences,
  validateTrackers,
} from "@/settings/preferences";
import { PreferenceRow } from "@/settings/preference-row";
import NekoTorrent from "../../modules/neko-torrent/src/NekoTorrentModule";
import { formatBytes } from "@shared/format";
import { theme } from "@/theme";
import { Button } from "@/ui/button";
import { OptionSheet } from "@/ui/option-sheet";
import { Screen, SCREEN_PADDING } from "@/ui/screen";

export default function PlaybackSettingsScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const group =
    category && Object.hasOwn(SETTINGS_CATEGORIES, category)
      ? SETTINGS_CATEGORIES[category as SettingsCategory]
      : null;
  const { values, ready, error } = usePreferences();
  const [editing, setEditing] = useState<Setting | null>(null);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState("");
  const [busy, setBusy] = useState(false);

  async function update(setting: Setting, value: string | number | boolean) {
    setBusy(true);
    try {
      await savePreferences({ [setting.key]: value });
      setEditing(null);
    } catch (cause) {
      Alert.alert(
        "Could not save setting",
        cause instanceof Error ? cause.message : "Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openEditor(setting: Setting) {
    setDraft(String(values[setting.key]));
    setInputError("");
    setEditing(setting);
  }

  function saveInput() {
    if (!editing) return;
    try {
      let value: string | number = draft.trim();
      if (editing.kind === "number") {
        if (!/^\d+$/.test(value)) throw new Error("Enter a whole number.");
        value = Number(value);
        const automatic = value === 0 && !!editing.zeroLabel;
        if (!automatic && (value < editing.min || value > editing.max))
          throw new Error(
            `Enter a number from ${editing.min} to ${editing.max}${editing.zeroLabel ? ", or 0" : ""}.`,
          );
      }
      if (editing.key === "trackers") value = validateTrackers(String(value));
      if (editing.key === "subtitleExclude" && String(value).length > 500)
        throw new Error("Use at most 500 characters.");
      void update(editing, value);
    } catch (cause) {
      setInputError(cause instanceof Error ? cause.message : "Invalid value.");
    }
  }

  async function clearCache() {
    if (!NekoTorrent) return;
    setBusy(true);
    try {
      const removed = await NekoTorrent.clearCacheAsync();
      Alert.alert(
        "Torrent cache cleared",
        `${formatBytes(removed) ?? "0 bytes"} removed. The active stream is kept.`,
      );
    } catch (cause) {
      Alert.alert(
        "Could not clear cache",
        cause instanceof Error ? cause.message : "Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={styles.back}
        >
          <Feather name="arrow-left" size={24} color={theme.color.foreground} />
        </Pressable>
        <Text style={styles.title}>{group?.title ?? "Playback settings"}</Text>
      </View>
      {!ready ? (
        <ActivityIndicator color={theme.color.accent} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!group
            ? Object.entries(SETTINGS_CATEGORIES).map(([key, item]) => (
                <Pressable
                  key={key}
                  style={styles.row}
                  onPress={() =>
                    router.push({
                      pathname: "/playback-settings",
                      params: { category: key },
                    })
                  }
                  accessibilityRole="button"
                >
                  <Feather
                    name={item.icon}
                    color={theme.color.accent}
                    size={24}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.label}>{item.title}</Text>
                    <Text style={styles.detail}>{item.detail}</Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    color={theme.color.muted}
                    size={20}
                  />
                </Pressable>
              ))
            : (group.settings as Setting[]).map((setting) => (
                <PreferenceRow
                  key={setting.key}
                  setting={setting}
                  values={values}
                  disabled={busy}
                  onEdit={() => openEditor(setting)}
                  onToggle={(value) => void update(setting, value)}
                />
              ))}
          {category === "torrent" ? (
            <>
              <Text style={styles.hint}>
                Torrent changes apply when opening a new stream. The server
                accepts connections only from this phone.
              </Text>
              <Button
                label="Clear unused torrent cache"
                variant="outline"
                disabled={busy || !NekoTorrent}
                onPress={() =>
                  Alert.alert(
                    "Clear unused torrent cache?",
                    "Remove temporary files left by stopped streams. Your library and active stream are kept.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Clear", onPress: () => void clearCache() },
                    ],
                  )
                }
              />
            </>
          ) : null}
          {group ? (
            <Button
              label="Reset these settings"
              variant="ghost"
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  `Reset ${group.title.toLowerCase()} settings?`,
                  "Restore the defaults for this category.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Reset",
                      onPress: () => {
                        setBusy(true);
                        const patch = Object.fromEntries(
                          group.settings.map((setting) => [
                            setting.key,
                            DEFAULT_PREFERENCES[setting.key],
                          ]),
                        );
                        void savePreferences(patch)
                          .catch(() => Alert.alert("Could not reset settings"))
                          .finally(() => setBusy(false));
                      },
                    },
                  ],
                )
              }
            />
          ) : (
            <Text style={styles.hint}>
              NekoStream uses the device video decoder. Available codecs and
              subtitle rendering depend on your phone.
            </Text>
          )}
        </ScrollView>
      )}
      {editing?.kind === "select" ? (
        <OptionSheet
          visible
          title={editing.title}
          selected={String(values[editing.key])}
          options={editing.choices}
          onSelect={(value) =>
            void update(editing, editing.numeric ? Number(value) : value)
          }
          onClose={() => setEditing(null)}
        />
      ) : null}
      <Modal
        visible={!!editing && editing.kind !== "select"}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setEditing(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modal}
        >
          <View style={styles.dialog}>
            <Text style={styles.title}>{editing?.title}</Text>
            {editing?.detail ? (
              <Text style={styles.detail}>{editing.detail}</Text>
            ) : null}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              style={[
                styles.input,
                editing?.kind === "text" &&
                  editing.multiline &&
                  styles.multiline,
              ]}
              keyboardType={
                editing?.kind === "number" ? "number-pad" : "default"
              }
              multiline={editing?.kind === "text" && editing.multiline}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={editing?.title}
              editable={!busy}
            />
            {inputError ? <Text style={styles.error}>{inputError}</Text> : null}
            <View style={styles.actions}>
              <Button
                label="Cancel"
                variant="ghost"
                disabled={busy}
                onPress={() => setEditing(null)}
              />
              <Button label="Save" busy={busy} onPress={saveInput} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...theme.type.title, color: theme.color.foreground, flexShrink: 1 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 40 },
  row: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingVertical: 16,
  },
  rowText: { flex: 1, gap: 6 },
  label: { ...theme.type.body, fontSize: 16, color: theme.color.foreground },
  detail: { ...theme.type.caption, color: theme.color.muted },
  hint: { ...theme.type.caption, color: theme.color.muted, marginVertical: 20 },
  error: { ...theme.type.body, color: theme.color.danger },
  modal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    backgroundColor: theme.color.surface,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  input: {
    color: theme.color.foreground,
    borderColor: theme.color.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 160, maxHeight: 280, textAlignVertical: "top" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
});
