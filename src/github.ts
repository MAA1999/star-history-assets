const GITHUB_API_VERSION = "2022-11-28";
const USER_AGENT = "MAA1999-star-history-assets";

interface Stargazer {
  starred_at?: unknown;
  user?: {
    login?: unknown;
  } | null;
}

export function parseNextLink(header: string | null): string | undefined {
  if (!header) return undefined;

  for (const entry of header.split(",")) {
    const match = entry.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2].split(/\s+/).includes("next")) return match[1];
  }

  return undefined;
}

async function githubError(response: Response, repository: string): Promise<Error> {
  const body = (await response.text()).slice(0, 500);
  const remaining = response.headers.get("x-ratelimit-remaining") ?? "unknown";
  const reset = response.headers.get("x-ratelimit-reset") ?? "unknown";
  return new Error(
    `GitHub API request failed for ${repository}: HTTP ${response.status}; remaining=${remaining}; reset=${reset}; response=${body}`,
  );
}

export async function fetchStargazerTimestamps(
  repository: string,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  let url: string | undefined = `https://api.github.com/repos/${repository}/stargazers?per_page=100`;
  const seenUsers = new Set<string>();
  const timestamps: string[] = [];
  let page = 0;

  while (url) {
    page += 1;
    const response = await fetcher(url, {
      headers: {
        Accept: "application/vnd.github.star+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) throw await githubError(response, repository);

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error(`GitHub API returned an unexpected response for ${repository}`);

    payload.forEach((item: Stargazer, index) => {
      const login = typeof item.user?.login === "string" ? item.user.login : `unknown:${page}:${index}`;
      if (seenUsers.has(login)) return;
      seenUsers.add(login);

      if (typeof item.starred_at === "string") timestamps.push(item.starred_at);
    });

    console.log(`${repository}: fetched page ${page}, ${timestamps.length} stargazers`);
    url = parseNextLink(response.headers.get("link"));
  }

  return timestamps.sort();
}
