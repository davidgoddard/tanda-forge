import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("tanda editor track menu", () => {
  const renderer = fs.readFileSync(
    path.join(process.cwd(), "app/src/renderer/renderer.ts"),
    "utf8",
  );

  it("keeps preview and move actions outside the shared overflow menu", () => {
    expect(renderer).toContain('menu.className = "tanda-track-menu"');
    expect(renderer).toContain('menuButton.dataset.action = "tanda-track-menu"');
    expect(renderer).toContain("actions.append(upButton, downButton)");
  });

  it("offers edit, search, conditional find, clipboard, and discard actions", () => {
    expect(renderer).toContain('"tanda-edit-track"');
    expect(renderer).toContain('"tanda-search-track"');
    expect(renderer).toContain('"tanda-find-track-tandas"');
    expect(renderer).toContain('"tanda-remove"');
    expect(renderer).toContain('"tanda-discard-track"');
    expect(renderer).toContain(
      "isTrackUsedInOtherTanda(trackTandaUsageCache.get(trackId), tanda)",
    );
    expect(renderer).toContain(
      "usage.tandaIds.some((id) => !editedSavedIds.has(id))",
    );
  });

  it("only sends the track to the clipboard for the clipboard action", () => {
    expect(renderer).toContain(
      'if (trackId && action === "tanda-remove")',
    );
    expect(renderer).toContain(
      'if (action === "tanda-remove" || action === "tanda-discard-track")',
    );
  });
});
