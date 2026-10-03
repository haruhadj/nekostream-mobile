const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withArm64Android(config) {
  return withAppBuildGradle(config, (result) => {
    const marker = "// NekoStream: arm64-only Android builds";
    if (!result.modResults.contents.includes(marker)) {
      result.modResults.contents += `
${marker}
if (project.findProperty('reactNativeArchitectures') != 'arm64-v8a') {
    throw new GradleException('NekoStream only supports arm64-v8a. Set reactNativeArchitectures=arm64-v8a.')
}
android {
    defaultConfig {
        ndk {
            abiFilters.clear()
            abiFilters.add('arm64-v8a')
        }
    }
}
`;
    }
    return result;
  });
};
