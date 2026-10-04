import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet } from "react-native";
type Icon = React.ComponentProps<typeof MaterialIcons>["name"];

export function ControlButton({
  icon,
  label,
  onPress,
  size = 24,
  large = false,
  disabled = false,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  size?: number;
  large?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.control,
        large && styles.playButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <MaterialIcons name={icon} size={size} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    minWidth: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  playButton: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 48,
  },
  disabled: { opacity: 0.3 },
  pressed: { backgroundColor: "rgba(255,255,255,0.12)" },
});
