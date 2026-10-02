import type { ConfigContext, ExpoConfig } from "expo/config";

/** Keep the development install separate from the user's release database. */
export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const development = process.env.NEKOSTREAM_VARIANT === "development";
  if (development && process.env.NEKOSTREAM_BUILD_MODE === "standalone") {
    throw new Error(
      "Standalone builds must use NEKOSTREAM_VARIANT=production. Keep NekoStream Dev for Fast Refresh.",
    );
  }
  const standalone = !development;
  return {
    ...config,
    name: development ? "NekoStream Dev" : "NekoStream",
    slug: "nekostream",
    plugins: [
      ...(config.plugins ?? []),
      "expo-background-task",
      "expo-notifications",
      "expo-video",
      [
        "expo-build-properties",
        {
          android: {
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            networkInspector: !standalone,
            // The in-app torrent stream is served from 127.0.0.1.
            usesCleartextTraffic: true,
          },
        },
      ],
      ...(standalone ? ["./plugins/with-standalone-android"] : []),
    ],
    android: {
      ...config.android,
      package: development
        ? "org.nekostream.mobile.dev"
        : "org.nekostream.mobile",
      intentFilters: [
        ...(config.android?.intentFilters ?? []),
        ...[
          "anilist.co",
          "www.anilist.co",
          "myanimelist.net",
          "www.myanimelist.net",
        ].map((host) => ({
          action: "VIEW",
          autoVerify: false,
          category: ["BROWSABLE", "DEFAULT"],
          data: ["https", "http"].map((scheme) => ({
            scheme,
            host,
            pathPrefix: "/anime/",
          })),
        })),
      ],
    },
    ios: {
      ...config.ios,
      bundleIdentifier: development
        ? "org.nekostream.mobile.dev"
        : "org.nekostream.mobile",
    },
  };
}
