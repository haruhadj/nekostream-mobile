import { parseAnimeLink } from "@/data/anime-link";
import { resolveOAuthNavigation } from "@/auth/url";

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  const oauthNavigation = resolveOAuthNavigation(path, initial);
  if (oauthNavigation !== null) return oauthNavigation;
  const anime = parseAnimeLink(path);
  if (anime) return `/add-anime?url=${encodeURIComponent(path)}`;
  // Preserve app routes; reject any other incoming web URL.
  if (/^https?:\/\//i.test(path)) return "/add-anime";
  return path;
}
