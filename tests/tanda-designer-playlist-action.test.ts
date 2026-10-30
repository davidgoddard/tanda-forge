import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("tanda designer playlist action", () => {
  it("always renders an add-to-playlist action using an independent playlist copy", () => {
    const renderer = fs.readFileSync(
      path.join(process.cwd(), "app/src/renderer/renderer.ts"),
      "utf8",
    );
    expect(renderer).toContain('playlistButton.dataset.action = "tanda-playlist"');
    expect(renderer).toContain('cloneTandaWithNewId(tanda, "playlist")');
    expect(renderer).toContain("playlistCopy.playlistUnsaved = true");
  });
});
