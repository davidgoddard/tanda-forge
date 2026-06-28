export type ReleaseUpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  releasesUrl: string;
};

type FetchLike = (
  input: string,
  init?: {
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

type GithubReleasePayload = {
  tag_name?: unknown;
  name?: unknown;
};

type GithubTagPayload = {
  name?: unknown;
};

type RemoteVersionCandidate = {
  version: string;
};

const GITHUB_REPO = "davidgoddard/tanda-forge";
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const TAGS_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=1`;
export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/`;
const DEFAULT_TIMEOUT_MS = 5000;

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const normalizeReleaseVersion = (value: string) =>
  value.trim().replace(/^v/i, "").replace(/\s+/g, "");

const extractReleaseVersion = (...values: string[]) => {
  for (const value of values) {
    const normalized = normalizeReleaseVersion(value);
    if (/^\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) {
      return normalized;
    }
  }
  return "";
};

const parseVersion = (value: string) => {
  const normalized = normalizeReleaseVersion(value);
  if (!normalized) {
    return { parts: [] as number[], prerelease: [] as string[] };
  }
  const [mainPart, prereleasePart = ""] = normalized.split("-", 2);
  const parts = mainPart
    .split(".")
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => Number.isFinite(segment));
  const prerelease = prereleasePart
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  return { parts, prerelease };
};

const comparePrereleaseSegments = (left: string[], right: string[]) => {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }
  if (left.length === 0) {
    return 1;
  }
  if (right.length === 0) {
    return -1;
  }
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftSegment = left[index];
    const rightSegment = right[index];
    if (leftSegment === undefined) {
      return -1;
    }
    if (rightSegment === undefined) {
      return 1;
    }
    const leftNumber = Number.parseInt(leftSegment, 10);
    const rightNumber = Number.parseInt(rightSegment, 10);
    const leftIsNumber = /^\d+$/.test(leftSegment);
    const rightIsNumber = /^\d+$/.test(rightSegment);
    if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
      return leftNumber > rightNumber ? 1 : -1;
    }
    if (leftIsNumber !== rightIsNumber) {
      return leftIsNumber ? -1 : 1;
    }
    if (leftSegment !== rightSegment) {
      return leftSegment > rightSegment ? 1 : -1;
    }
  }
  return 0;
};

export const compareReleaseVersions = (left: string, right: string) => {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  const length = Math.max(parsedLeft.parts.length, parsedRight.parts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = parsedLeft.parts[index] ?? 0;
    const rightPart = parsedRight.parts[index] ?? 0;
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }
  return comparePrereleaseSegments(parsedLeft.prerelease, parsedRight.prerelease);
};

const fetchJson = async <T>(
  fetchImpl: FetchLike,
  url: string,
  currentVersion: string,
  signal: AbortSignal,
) => {
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `Tanda Forge/${normalizeReleaseVersion(currentVersion) || "dev"}`,
      },
      signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const chooseLatestCandidate = (candidates: RemoteVersionCandidate[]) =>
  candidates.reduce<RemoteVersionCandidate | null>((latest, candidate) => {
    if (!latest) {
      return candidate;
    }
    return compareReleaseVersions(candidate.version, latest.version) > 0
      ? candidate
      : latest;
  }, null);

const getReleaseCandidate = (payload: GithubReleasePayload | null) => {
  if (!payload) {
    return null;
  }
  const version = extractReleaseVersion(asString(payload.tag_name), asString(payload.name));
  return version ? { version } : null;
};

const getTagCandidate = (payload: GithubTagPayload[] | null) => {
  const firstTag = payload?.[0];
  if (!firstTag) {
    return null;
  }
  const version = extractReleaseVersion(asString(firstTag.name));
  return version ? { version } : null;
};

export const isSupportedReleaseUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "github.com" &&
      parsed.pathname.startsWith(`/${GITHUB_REPO}/releases`)
    );
  } catch {
    return false;
  }
};

export const getReleaseUpdateInfo = async (
  currentVersion: string,
  options?: {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  },
): Promise<ReleaseUpdateInfo | null> => {
  const normalizedCurrentVersion = normalizeReleaseVersion(currentVersion);
  if (!normalizedCurrentVersion) {
    return null;
  }

  const fetchImpl = options?.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const [releasePayload, tagsPayload] = await Promise.all([
      fetchJson<GithubReleasePayload>(
        fetchImpl,
        RELEASES_API_URL,
        normalizedCurrentVersion,
        controller.signal,
      ),
      fetchJson<GithubTagPayload[]>(
        fetchImpl,
        TAGS_API_URL,
        normalizedCurrentVersion,
        controller.signal,
      ),
    ]);
    const latest = chooseLatestCandidate(
      [getReleaseCandidate(releasePayload), getTagCandidate(tagsPayload)].filter(
        Boolean,
      ) as RemoteVersionCandidate[],
    );
    if (!latest) {
      return null;
    }
    if (compareReleaseVersions(latest.version, normalizedCurrentVersion) <= 0) {
      return null;
    }
    return {
      currentVersion: normalizedCurrentVersion,
      latestVersion: latest.version,
      releasesUrl: RELEASES_PAGE_URL,
    };
  } finally {
    clearTimeout(timeout);
  }
};
