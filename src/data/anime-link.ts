export type AnimeLink = { provider: "anilist" | "mal"; id: number };

/** Accept only canonical anime detail paths on the actual tracker domains. */
export function parseAnimeLink(value: string): AnimeLink | null {
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const provider = ["anilist.co", "www.anilist.co"].includes(url.hostname)
      ? "anilist"
      : ["myanimelist.net", "www.myanimelist.net"].includes(url.hostname)
        ? "mal"
        : null;
    const match = /^\/anime\/([1-9]\d*)(?:\/[^/]+)?\/?$/.exec(url.pathname);
    if (!provider || !match) return null;
    const id = Number(match[1]);
    if (!Number.isSafeInteger(id) || id > 2147483647) return null;
    return { provider, id };
  } catch {
    return null;
  }
}
