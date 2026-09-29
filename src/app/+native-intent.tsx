import { parseAnimeLink } from "@/data/anime-link";

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  const anime = parseAnimeLink(path);
  if (anime) return `/add-anime?url=${encodeURIComponent(path)}`;
  // Preserve app routes and OAuth redirects; reject any other incoming web URL.
  if (/^https?:\/\//i.test(path)) return "/add-anime";
  return path;
}
