const { withSettingsGradle } = require("expo/config-plugins");

module.exports = function withStandaloneAndroid(config) {
  return withSettingsGradle(config, (result) => {
    const marker = "expoAutolinking.useExpoModules()";
    const exclusion =
      "expoAutolinking.exclude = ['expo-dev-client', 'expo-dev-launcher', 'expo-dev-menu', 'expo-dev-menu-interface']";
    if (!result.modResults.contents.includes(exclusion)) {
      if (!result.modResults.contents.includes(marker)) {
        throw new Error(
          "Could not locate Expo autolinking in settings.gradle.",
        );
      }
      result.modResults.contents = result.modResults.contents.replace(
        marker,
        `${exclusion}\n${marker}`,
      );
    }
    return result;
  });
};
