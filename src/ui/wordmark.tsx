import { StyleSheet, Text } from "react-native";
import { theme } from "@/theme";
export function Wordmark() {
  return (
    <Text style={styles.wordmark}>
      neko<Text style={styles.stream}>stream</Text>
    </Text>
  );
}
const styles = StyleSheet.create({
  wordmark: {
    color: theme.color.foreground,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  stream: { color: theme.color.accent },
});
