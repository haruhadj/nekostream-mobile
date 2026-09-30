import { anilistRequest } from "@shared/anilist/client";

export type DiscoverMedia = {
  id: number;
  idMal: number | null;
  title: { romaji: string; english: string | null };
  coverImage: { large: string | null } | null;
  episodes: number | null;
  format: string | null;
  status: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  genres: string[] | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
};

export type DiscoverPage = {
  pageInfo: { total: number; currentPage: number; hasNextPage: boolean };
  media: DiscoverMedia[];
};

export type DiscoverSort =
  | "POPULARITY_DESC"
  | "TRENDING_DESC"
  | "SCORE_DESC"
  | "SEARCH_MATCH";
export type DiscoverSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";
export type DiscoverFormat = "all" | "tv" | "movie" | "ova" | "ona";

const FORMAT_VALUES: Record<DiscoverFormat, string[] | null> = {
  all: null,
  tv: ["TV", "TV_SHORT"],
  movie: ["MOVIE"],
  ova: ["OVA"],
  ona: ["ONA"],
};

/** One page per request; controls and pagination never fetch unseen pages. */
export async function discoverAnime({
  page = 1,
  search = null,
  season = null,
  seasonYear = null,
  status = null,
  format = "all",
  sort = "POPULARITY_DESC",
}: {
  page?: number;
  search?: string | null;
  season?: DiscoverSeason | null;
  seasonYear?: number | null;
  status?: "RELEASING" | "NOT_YET_RELEASED" | null;
  format?: DiscoverFormat;
  sort?: DiscoverSort;
} = {}): Promise<DiscoverPage> {
  const data = await anilistRequest<{ Page: DiscoverPage }>(
    `query (
      $page: Int, $search: String, $season: MediaSeason,
      $seasonYear: Int, $status: MediaStatus,
      $formatIn: [MediaFormat], $sort: [MediaSort]
    ) {
      Page(page: $page, perPage: 20) {
        pageInfo { total currentPage hasNextPage }
        media(
          type: ANIME, isAdult: false, search: $search,
          season: $season, seasonYear: $seasonYear,
          status: $status, format_in: $formatIn, sort: $sort
        ) {
          id idMal
          title { romaji english }
          coverImage { large }
          episodes format status seasonYear averageScore genres
          nextAiringEpisode { episode airingAt }
        }
      }
    }`,
    {
      page,
      search,
      season,
      seasonYear,
      status,
      formatIn: FORMAT_VALUES[format],
      sort: [sort],
    },
  );

  return data.Page;
}
