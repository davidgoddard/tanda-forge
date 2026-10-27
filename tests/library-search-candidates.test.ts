import { describe, expect, it } from "vitest";
import { fetchSearchCandidates } from "../app/src/main/library/search";

type MockTrack = {
  id: string;
  genre: string;
  rootKind: "music" | "cortina";
  hidden?: boolean;
  searchRepresentativeId?: string;
};

const makeMockDb = (tracks: MockTrack[]) => {
  return {
    prepare: (sql: string) => ({
      all: (...values: unknown[]) => {
        const styleSet = new Set(values as string[]);
        return tracks.filter((track) => {
          if (track.rootKind !== "music") {
            return false;
          }
          if (sql.includes("hidden_tracks") && track.hidden) {
            return false;
          }
          if (sql.includes("'same-recording'")
            && track.searchRepresentativeId && track.searchRepresentativeId !== track.id) {
            return false;
          }
          if (sql.includes("t.genre in (") && styleSet.size > 0) {
            return styleSet.has(track.genre);
          }
          return true;
        });
      },
    }),
  };
};

describe("search candidate source filtering", () => {
  it("includes only music-root tracks and applies optional style filter", () => {
    const db = makeMockDb([
      { id: "music-tango", rootKind: "music", genre: "Tango" },
      { id: "music-milonga", rootKind: "music", genre: "Milonga" },
      { id: "cortina-track", rootKind: "cortina", genre: "Tango" },
    ]);

    const all = fetchSearchCandidates(db as any, []);
    expect(all.map((row: any) => row.id)).toEqual(["music-tango", "music-milonga"]);

    const tangoOnly = fetchSearchCandidates(db as any, ["Tango"]);
    expect(tangoOnly.map((row: any) => row.id)).toEqual(["music-tango"]);
  });

  it("renders one representative for identical and same-recording groups", () => {
    const db = makeMockDb([
      { id: "master", rootKind: "music", genre: "Tango", searchRepresentativeId: "master" },
      { id: "identical-copy", rootKind: "music", genre: "Tango", searchRepresentativeId: "master" },
      { id: "recording-a", rootKind: "music", genre: "Tango", searchRepresentativeId: "recording-a" },
      { id: "recording-b", rootKind: "music", genre: "Tango", searchRepresentativeId: "recording-a" },
      { id: "different-performance", rootKind: "music", genre: "Tango" },
      { id: "hidden", rootKind: "music", genre: "Tango", hidden: true },
    ]);

    const candidates = fetchSearchCandidates(db as any, []);

    expect(candidates.map((row: any) => row.id)).toEqual([
      "master", "recording-a", "different-performance",
    ]);
  });
});
