const ANILIST_ENDPOINT = "https://graphql.anilist.co";

/** Keep well below AniList's temporary 30-request/minute ceiling, including
 * while another request is in flight or several screens refresh together. */
const MIN_REQUEST_GAP_MS = 3_000;
const RATE_LIMIT_RETRIES = 1;
const RATE_LIMIT_FALLBACK_MS = 60_000;

let nextRequestGapMs = MIN_REQUEST_GAP_MS;
let nextAllowedAt = 0;
let queue: Promise<void> = Promise.resolve();

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Serialize every AniList call so independent screens cannot burst together. */
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const delay = Math.max(nextAllowedAt, Date.now()) - Date.now();
    if (delay > 0) await wait(delay);
    nextAllowedAt = Date.now() + nextRequestGapMs;
    return operation();
  });
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function retryDelayMs(response: Response): number | null {
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }

  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    return Math.max(0, reset * 1_000 - Date.now());
  }

  return null;
}

function observeRateLimit(response: Response) {
  const limit = Number(response.headers.get("x-ratelimit-limit"));
  if (Number.isFinite(limit) && limit > 0) {
    // Keep 20% headroom below the advertised rolling-window limit.
    nextRequestGapMs = Math.max(MIN_REQUEST_GAP_MS, (60_000 / limit) * 1.2);
  }

  const remaining = response.headers.get("x-ratelimit-remaining");
  if (remaining !== null && Number(remaining) === 0) {
    nextAllowedAt = Math.max(
      nextAllowedAt,
      Date.now() + (retryDelayMs(response) ?? RATE_LIMIT_FALLBACK_MS),
    );
  }
}

export class AniListError extends Error {
  status: number;
  /** Seconds to wait, when AniList reports a rate limit. */
  retryAfter: number | null;

  constructor(
    message: string,
    { status = 500, retryAfter = null as number | null } = {},
  ) {
    super(message);
    this.name = "AniListError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; status?: number }>;
};

/**
 * Search and metadata reads work unauthenticated; pass a token only for
 * viewer-scoped queries and list mutations.
 */
export async function anilistRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  {
    accessToken,
    timeoutMs = 15_000,
  }: { accessToken?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await enqueue(async () => {
        let response: Response;
        try {
          response = await fetch(ANILIST_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...(accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : {}),
            },
            body: JSON.stringify({ query, variables }),
            signal: AbortSignal.timeout(timeoutMs),
            cache: "no-store",
          });
        } catch {
          throw new AniListError("Could not reach AniList.", { status: 502 });
        }

        observeRateLimit(response);
        const json = (await response
          .json()
          .catch(() => null)) as GraphQLResponse<T> | null;
        const apiError = json?.errors?.[0];
        const status = apiError?.status ?? response.status;
        const retryAfter = retryDelayMs(response);

        if (
          status === 429 ||
          /too many requests/i.test(apiError?.message ?? "")
        ) {
          nextAllowedAt = Math.max(
            nextAllowedAt,
            Date.now() + (retryAfter ?? RATE_LIMIT_FALLBACK_MS),
          );
          throw new AniListError(
            "AniList rate limited this request. Wait a moment before trying again.",
            {
              status: 429,
              retryAfter: Math.ceil(
                (retryAfter ?? RATE_LIMIT_FALLBACK_MS) / 1_000,
              ),
            },
          );
        }

        if (
          status === 403 &&
          /temporarily disabled|severe stability issues/i.test(
            apiError?.message ?? "",
          )
        ) {
          nextAllowedAt = Math.max(
            nextAllowedAt,
            Date.now() + RATE_LIMIT_FALLBACK_MS,
          );
        }

        if (!json) {
          throw new AniListError("AniList returned a malformed response.", {
            status: 502,
          });
        }

        if (apiError) {
          throw new AniListError(apiError.message, { status });
        }

        if (!response.ok || !json.data) {
          throw new AniListError(`AniList returned ${response.status}.`, {
            status: response.status,
          });
        }

        return json.data;
      });
    } catch (error) {
      if (
        !(error instanceof AniListError) ||
        error.status !== 429 ||
        attempt >= RATE_LIMIT_RETRIES
      ) {
        throw error;
      }
      // One retry only. The shared queue applies Retry-After first, so other
      // screens and sync work remain paced while this operation waits.
    }
  }
}
