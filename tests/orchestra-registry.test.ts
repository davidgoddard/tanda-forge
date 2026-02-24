import { describe, expect, it } from "vitest";

import {
  buildOrchestraAliasIndex,
  normalizeOrchestraText,
  resolveOrchestraCanonical,
  type OrchestraRegistryEntry,
} from "../app/src/shared/orchestra-registry.js";

describe("normalizeOrchestraText", () => {
  it("normalizes diacritics and stop words", () => {
    expect(normalizeOrchestraText("Orquesta Típica Carlos Di Sarli")).toBe(
      "carlos di sarli",
    );
  });

  it("normalizes punctuation variants", () => {
    expect(normalizeOrchestraText("Juan D'Arienzo")).toBe("juan darienzo");
    expect(normalizeOrchestraText("Juan D Arienzo")).toBe("juan d arienzo");
  });
});

describe("resolveOrchestraCanonical", () => {
  const entries: OrchestraRegistryEntry[] = [
    {
      id: "di-sarli",
      canonical: "Carlos Di Sarli",
      aliases: ["Di Sarli", "Orquesta Tipica Carlos Di Sarli"],
      related: [],
    },
    {
      id: "troilo",
      canonical: "Anibal Troilo",
      aliases: ["Aníbal Troilo", "Troilo"],
      related: [],
    },
  ];
  const aliasIndex = buildOrchestraAliasIndex(entries);

  it("resolves canonical value from alias", () => {
    expect(
      resolveOrchestraCanonical({
        rawArtist: "Orquesta Típica Carlos Di Sarli",
        entries,
        aliasIndex,
      }),
    ).toBe("Carlos Di Sarli");
  });

  it("returns null when no alias is known", () => {
    expect(
      resolveOrchestraCanonical({
        rawArtist: "Unknown Ensemble",
        entries,
        aliasIndex,
      }),
    ).toBeNull();
  });
});
