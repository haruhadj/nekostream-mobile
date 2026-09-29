import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme } from "@/theme";

export function Input({
  style,
  icon,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { icon?: React.ComponentProps<typeof Feather>["name"] }) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.field,
        focused && styles.focused,
        style as StyleProp<ViewStyle>,
      ]}
    >
      {icon ? (
        <Feather name={icon} size={18} color={theme.color.muted} />
      ) : null}
      <TextInput
        {...props}
        placeholderTextColor={theme.color.muted}
        selectionColor={theme.color.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={styles.input}
      />
      {icon && props.value && props.onChangeText ? (
        <Pressable
          onPress={() => props.onChangeText?.("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clear}
        >
          <Feather name="x" size={18} color={theme.color.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 6,
  },
  focused: { borderColor: theme.color.accent },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 10,
    paddingRight: 8,
    color: theme.color.foreground,
    fontSize: 14,
  },
  clear: {
    minHeight: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
