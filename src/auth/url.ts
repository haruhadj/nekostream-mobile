/**
 * URL and form encoding for the OAuth flows — deliberately free of any
 * `expo-*` import, so it can be exercised outside the app (see the Phase 2
 * verification in this project's history). `oauth.ts` holds the parts
 * that genuinely need the device: randomness and the browser.
 *
 * Hand-rolled rather than `URL`/`URLSearchParams`, because React Native ships
 * partial polyfills of both and this app has already been bitten once by
 * assuming a web API is present (`src/polyfills.ts`).
 */

export function buildUrl(base: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${base}?${query}`;
}

/** `application/x-www-form-urlencoded` body, for the token endpoints. */
export function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/** The browser session owns warm OAuth callbacks, not the navigation stack. */
export function resolveOAuthNavigation(path: string, initial: boolean): string | null {
  if (!/^(?:nekostream:\/\/\/?|\/?)auth\/(?:anilist|mal)\/?(?:[?#]|$)/i.test(path)) {
    return null;
  }
  // Expo Router skips navigation for an empty warm-link result. The browser's
  // independent Linking listener still receives the original URL and token.
  // On cold launch, use the normal auth gate and discard OAuth URL parameters.
  return initial ? "/" : "";
}

/**
 * Both halves of a redirect: `?query` (authorization code — MAL) and
 * `#fragment` (implicit grant — AniList). Parsed together because which one
 * carries the answer is the provider's choice, not ours.
 */
export function parseRedirectParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  // Everything after the scheme, so a `nekostream://auth/anilist#...` redirect
  // is treated the same as an https one.
  const afterScheme = url.split("://")[1] ?? url;
  const queryPart = afterScheme.split("?")[1]?.split("#")[0] ?? "";
  const fragmentPart = afterScheme.split("#")[1]?.split("?")[0] ?? "";

  for (const part of [queryPart, fragmentPart]) {
    if (!part) continue;
    for (const pair of part.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const key = eq === -1 ? pair : pair.slice(0, eq);
      const value = eq === -1 ? "" : pair.slice(eq + 1);
      params[decodeURIComponent(key)] = decodeURIComponent(
        value.replace(/\+/g, " ")
      );
    }
  }

  return params;
}
