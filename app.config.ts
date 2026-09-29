import type { ConfigContext, ExpoConfig } from "expo/config";

/** Keep the development install separate from the user's release database. */
export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const development = process.env.NEKOSTREAM_VARIANT === "development";
  return {
    ...config,
    name: development ? "NekoStream Dev" : "NekoStream",
    slug: "nekostream",
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
