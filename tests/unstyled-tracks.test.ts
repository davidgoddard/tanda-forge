import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { listUnstyledTrackIds } from "../app/src/main/library/unstyled-tracks";

describe("unstyled tracks", () => {
  it("returns active visible music tracks with a blank or legacy unknown style", () => {
    const all = vi.fn(() => [{ id: "b" }, { id: "a" }]);
    const prepare = vi.fn(() => ({ all }));
    const ids = listUnstyledTrackIds({ prepare } as never);

    expect(ids).toEqual(["b", "a"]);
    expect(prepare.mock.calls[0]?.[0]).toContain("r.kind = 'music'");
    expect(prepare.mock.calls[0]?.[0]).toContain("t.deleted_at is null");
    expect(prepare.mock.calls[0]?.[0]).toContain("coalesce(trim(t.genre), '') in ('', '?')");
    expect(prepare.mock.calls[0]?.[0]).toContain("hidden_tracks");
  });

  it("resets the shared style filter when the Unstyled collection is selected", () => {
    const renderer = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/renderer.ts"),
      "utf8",
    );
    expect(renderer).toContain(
      "collection.id === CLIPBOARD_UNSTYLED_ID && selectedStyles.length > 0",
    );
    expect(renderer).toContain("selectedStyles = [];");
    expect(renderer).toContain("void loadStyles();");
  });
});
