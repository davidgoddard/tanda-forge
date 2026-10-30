import { describe, expect, it } from "vitest";
import {
  belongsToSavedTanda,
  getSavedTandaId,
} from "../app/src/renderer/tanda-deletion";

describe("tanda deletion identity", () => {
  it("targets the saved master when deleting a playlist-local variant", () => {
    expect(getSavedTandaId({
      id: "playlist-copy",
      masterTandaId: "saved-master",
      playlistUnsaved: true,
    })).toBe("saved-master");
  });

  it("does not offer database deletion for a playlist-only tanda", () => {
    expect(getSavedTandaId({
      id: "playlist-only",
      masterTandaId: null,
      playlistUnsaved: true,
    })).toBeNull();
  });

  it("recognises both direct and local-variant playlist uses of a saved tanda", () => {
    expect(belongsToSavedTanda(null, "saved-master", "saved-master")).toBe(true);
    expect(belongsToSavedTanda({
      id: "playlist-copy",
      masterTandaId: "saved-master",
    }, "playlist-copy", "saved-master")).toBe(true);
    expect(belongsToSavedTanda(null, "another-tanda", "saved-master")).toBe(false);
  });
});
