import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { theme } from "@/theme";
import type { Setting } from "./catalog";
import type { Preferences } from "./preferences";

export function PreferenceRow({
  setting,
  values,
  disabled,
  onEdit,
  onToggle,
}: {
  setting: Setting;
  values: Preferences;
  disabled: boolean;
  onEdit: () => void;
  onToggle: (value: boolean) => void;
}) {
  const description = (
    <View style={styles.text}>
      <Text style={styles.label}>{setting.title}</Text>
      {setting.kind !== "toggle" ? (
        <Text style={styles.value}>{settingValue(setting, values)}</Text>
      ) : null}
      {setting.detail ? (
        <Text style={styles.detail}>{setting.detail}</Text>
      ) : null}
    </View>
  );
  if (setting.kind === "toggle") {
    return (
      <Pressable
        style={styles.row}
        disabled={disabled}
        onPress={() => onToggle(values[setting.key] !== true)}
        accessibilityRole="switch"
        accessibilityLabel={setting.title}
        accessibilityState={{ checked: values[setting.key] === true, disabled }}
      >
        {description}
        <Switch
          value={values[setting.key] === true}
          disabled={disabled}
          onValueChange={onToggle}
          accessibilityLabel={setting.title}
          trackColor={{ true: theme.color.accent }}
        />
      </Pressable>
    );
  }
  return (
    <Pressable
      style={styles.row}
      disabled={disabled}
      onPress={onEdit}
      accessibilityRole="button"
    >
      {description}
      <Feather name="chevron-right" color={theme.color.muted} size={20} />
    </Pressable>
  );
}

function settingValue(setting: Setting, values: Preferences) {
  const value = values[setting.key];
  if (setting.kind === "select")
    return setting.choices.find((choice) => choice.key === String(value))
      ?.label;
  if (setting.kind === "number" && value === 0 && setting.zeroLabel)
    return setting.zeroLabel;
  if (setting.key === "trackers")
    return `${values.trackers.split(/\s+/).filter(Boolean).length} additional trackers`;
  return String(value) || "None";
}

const styles = StyleSheet.create({
  row: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  text: { flex: 1, gap: 6 },
  label: { ...theme.type.body, fontSize: 16, color: theme.color.foreground },
  value: { ...theme.type.body, color: theme.color.accent },
  detail: { ...theme.type.caption, color: theme.color.muted },
});
