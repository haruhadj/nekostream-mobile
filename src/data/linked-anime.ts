import { anilistRequest } from "@shared/anilist/client";
import type { AnimeLink } from "./anime-link";

export type LinkedAnime = {
  id: number;
  idMal: number | null;
  type: string;
  title: { romaji: string; english: string | null };
  coverImage: { large: string | null } | null;
  episodes: number | null;
  format: string | null;
  status: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  genres: string[] | null;
  description: string | null;
};

export async function resolveAnimeLink(link: AnimeLink): Promise<LinkedAnime> {
  const field = link.provider === "mal" ? "idMal" : "id";
  const { Media } = await anilistRequest<{ Media: LinkedAnime | null }>(
    `query ($id: Int!) {
      Media(${field}: $id, type: ANIME) {
        id idMal type title { romaji english } coverImage { large }
        episodes format status seasonYear averageScore genres
        description(asHtml: false)
      }
    }`,
    { id: link.id },
  );
  if (
    !Media ||
    Media.type !== "ANIME" ||
    (link.provider === "mal" ? Media.idMal : Media.id) !== link.id
  ) {
    throw new Error(
      "No matching anime found. Manga and other content cannot be added.",
    );
  }
  return Media;
}
