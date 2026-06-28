import { describe, expect, it, vi } from "vitest";
import {
  compareReleaseVersions,
  getReleaseUpdateInfo,
  isSupportedReleaseUrl,
  normalizeReleaseVersion,
  RELEASES_PAGE_URL,
} from "../app/src/main/release-check";

describe("release check", () => {
  it("normalizes GitHub-style tag names", () => {
    expect(normalizeReleaseVersion(" v0.3.12 ")).toBe("0.3.12");
  });

  it("compares stable and prerelease versions correctly", () => {
    expect(compareReleaseVersions("0.3.12", "0.3.11")).toBeGreaterThan(0);
    expect(compareReleaseVersions("0.3.12", "0.3.12")).toBe(0);
    expect(compareReleaseVersions("0.3.12", "0.3.13")).toBeLessThan(0);
    expect(compareReleaseVersions("0.3.12", "0.3.12-beta.1")).toBeGreaterThan(0);
  });

  it("returns update info when GitHub reports a newer release", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/releases/latest")) {
        return {
          ok: true,
          json: async () => ({ tag_name: "v0.3.13" }),
        };
      }
      return {
        ok: true,
        json: async () => [{ name: "v0.3.12" }],
      };
    });

    await expect(
      getReleaseUpdateInfo("0.3.12", {
        fetchImpl,
        timeoutMs: 100,
      }),
    ).resolves.toEqual({
      currentVersion: "0.3.12",
      latestVersion: "0.3.13",
      releasesUrl: RELEASES_PAGE_URL,
    });
  });

  it("falls back to tags when the latest release endpoint is unavailable", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/releases/latest")) {
        return {
          ok: false,
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        json: async () => [{ name: "v0.3.14" }],
      };
    });

    await expect(
      getReleaseUpdateInfo("0.3.12", {
        fetchImpl,
        timeoutMs: 100,
      }),
    ).resolves.toEqual({
      currentVersion: "0.3.12",
      latestVersion: "0.3.14",
      releasesUrl: RELEASES_PAGE_URL,
    });
  });

  it("returns null when the current version is already up to date", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/releases/latest")) {
        return {
          ok: true,
          json: async () => ({ tag_name: "v0.3.12" }),
        };
      }
      return {
        ok: true,
        json: async () => [{ name: "v0.3.12" }],
      };
    });

    await expect(
      getReleaseUpdateInfo("0.3.12", {
        fetchImpl,
        timeoutMs: 100,
      }),
    ).resolves.toBeNull();
  });

  it("only allows GitHub release URLs for the configured repo", () => {
    expect(isSupportedReleaseUrl("https://github.com/davidgoddard/tanda-forge/releases/")).toBe(
      true,
    );
    expect(
      isSupportedReleaseUrl(
        "https://github.com/davidgoddard/tanda-forge/releases/tag/v0.3.13",
      ),
    ).toBe(true);
    expect(isSupportedReleaseUrl("https://example.com/releases")).toBe(false);
  });
});
