import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router/js-tabs";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopWidth: 0,
          height: 76 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600", marginTop: 4 },
      }}
    >
      {(
        [
          ["index", "Library", "book-open"],
          ["schedule", "Airing", "calendar"],
          ["search", "Discover", "compass"],
          ["settings", "You", "user"],
        ] as const
      ).map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width: 60,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: focused
                    ? theme.color.accentContainer
                    : "transparent",
                }}
              >
                <Feather name={icon} color={color} size={21} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
