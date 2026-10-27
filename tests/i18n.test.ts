import { describe, expect, it } from "vitest";
import {
  SUPPORTED_LANGUAGES,
  translate,
  translations,
  type LanguageKey,
} from "../app/src/renderer/i18n";

describe("renderer i18n", () => {
  const shortActionMenus = [
    [
      "actionEditTrackShort",
      "actionSearchShort",
      "actionFindTandasShort",
      "actionAddClipboardShort",
      "actionAddPlaylistShort",
      "actionAddTandaShort",
    ],
    [
      "actionEditTrackShort",
      "actionSearchShort",
      "actionFindTandasShort",
      "actionAddPlaylistShort",
      "actionAddTandaShort",
      "actionMoveCollectionShort",
      "actionRemoveClipboardShort",
    ],
    [
      "actionEditTrackShort",
      "actionSearchShort",
      "actionFindTandasShort",
      "actionSendClipboardShort",
      "actionMarkPlaylistTrackShort",
    ],
    [
      "actionSearchShort",
      "actionEditTandaShort",
      "actionAddPlaylistShort",
      "actionAddClipboardShort",
    ],
    [
      "actionSearchShort",
      "actionEditTandaShort",
      "actionAddPlaylistShort",
      "actionMoveCollectionShort",
      "actionRemoveClipboardShort",
    ],
    [
      "actionEditTandaShort",
      "actionMarkPlaylistShort",
      "actionSwapPlaylistShort",
      "actionSendClipboardShort",
    ],
    [
      "actionEditTrackShort",
      "tandaMoveUpShort",
      "tandaMoveDownShort",
      "actionSendClipboardShort",
    ],
  ] as const;

  it("exposes all supported languages", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "es", "fr", "de", "pt", "it", "is"]);
  });

  it("returns language key fallback when missing in all maps", () => {
    expect(translate("en", "__missing_key__")).toBe("__missing_key__");
  });

  it("defines every english key in every supported language map", () => {
    const englishKeys = Object.keys(translations.en);
    for (const language of SUPPORTED_LANGUAGES) {
      const languageKeys = Object.keys(translations[language] ?? {});
      const missing = englishKeys.filter((key) => !languageKeys.includes(key));
      expect(missing, `${language}: ${missing.join(",")}`).toEqual([]);
    }
  });

  it("fully translates the AV-lag settings and calibration component", () => {
    const keys = Object.keys(translations.en).filter((key) => key.startsWith("displayAvLag"));
    expect(keys.length).toBeGreaterThanOrEqual(10);
    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of keys) {
        expect(translations[language][key], `${language}.${key}`).toBeTruthy();
      }
    }
    for (const language of SUPPORTED_LANGUAGES.filter((language) => language !== "en")) {
      expect(translations[language].displayAvLagLabel).not.toBe(translations.en.displayAvLagLabel);
      expect(translations[language].displayAvLagCalibrate).not.toBe(translations.en.displayAvLagCalibrate);
      expect(translations[language].displayAvLagCalibrationHelp).not.toBe(translations.en.displayAvLagCalibrationHelp);
    }
  });

  it("keeps similarity translations and interpolation parameters complete", () => {
    const similarityKeys = Object.keys(translations.en)
      .filter((key) => key.startsWith("audioSimilarity"));
    const placeholders = (value: string) =>
      [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
    for (const language of SUPPORTED_LANGUAGES) {
      for (const key of similarityKeys) {
        expect(translations[language][key], `${language}.${key}`).toBeTruthy();
        expect(
          placeholders(translations[language][key]),
          `${language}.${key} placeholders`,
        ).toEqual(placeholders(translations.en[key]));
      }
    }
    expect(translations.is.audioSimilarityTitle).not.toBe(translations.en.audioSimilarityTitle);
    expect(translations.is.audioSimilarityRejectNamedPair)
      .not.toBe(translations.en.audioSimilarityRejectNamedPair);
  });

  it("interpolates parameters in translated strings", () => {
    const value = translate("en", "audioDynamicsPathOriginal", {
      path: "/tmp/example.wav",
    });
    expect(value).toContain("/tmp/example.wav");
  });

  it("interpolates the app subtitle with the live version string", () => {
    expect(
      translate("en", "appSubtitle", {
        version: "0.3.8",
      }),
    ).toBe("Version: 0.3.8 © David Goddard 2026");
  });

  it("interpolates the update popup message with the remote version string", () => {
    expect(
      translate("en", "releaseUpdateMessage", {
        version: "0.3.13",
      }),
    ).toBe("New version available: 0.3.13. Open the releases page?");
  });

  it("interpolates output routing failure details", () => {
    const value = translate("en", "outputRoutingFailedDetail", {
      channel: "Main output",
      device: "USB Device",
      message: "NotFoundError",
    });
    expect(value).toContain("Main output");
    expect(value).toContain("USB Device");
    expect(value).toContain("NotFoundError");
  });

  it("falls back to the key when a translation value is unexpectedly non-string", () => {
    const mutated = translations as typeof translations & {
      en: Record<string, string | null>;
    };
    const original = mutated.en.searchButton;
    mutated.en.searchButton = null;
    try {
      expect(translate("en", "searchButton")).toBe("searchButton");
    } finally {
      mutated.en.searchButton = original;
    }
  });

  it("keeps popup short action labels unambiguous within each menu in every language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const menu of shortActionMenus) {
        const values = menu.map((key) => translate(language, key));
        const uniqueValues = new Set(values);
        expect(uniqueValues.size, `${language}: ${menu.join(",")}`).toBe(values.length);
      }
    }
  });

  it("uses localized initials for the Find tandas shortcut", () => {
    expect(Object.fromEntries(SUPPORTED_LANGUAGES.map((language) => [
      language,
      translate(language, "actionFindTandasShort"),
    ]))).toEqual({
      en: "FT",
      es: "BT",
      fr: "TT",
      de: "TF",
      pt: "ET",
      it: "TT",
      is: "FT",
    });
  });

  it("translates the late-added diversity and legacy labels in non-english maps", () => {
    const keys = [
      "legacyStylesButton",
      "playlistStatsTitle",
      "searchDiversityTitle",
      "searchDiversityOpportunitySummary",
      "searchDiversitySummaryText",
      "searchDiversitySuggestionCreateFirst",
      "playlistArtistRepeatGapLabel",
    ] as const;
    for (const language of SUPPORTED_LANGUAGES.filter((language) => language !== "en")) {
      for (const key of keys) {
        expect(translations[language][key], `${language}:${key}`).toBeTruthy();
        expect(translations[language][key], `${language}:${key}`).not.toBe(translations.en[key]);
      }
    }
  });

  it("uses the expected German wording for readiness and legacy-import labels", () => {
    expect(translations.de.legacyImportButton).toBe("Legacy-Bibliothek importieren");
    expect(translations.de.legacyReadinessButton).toBe("Bibliotheksbereitschaft pruefen");
    expect(translations.de.legacyImportDetected).toContain("library.dat und cortinas.dat importieren");
    expect(translations.de.libraryWorkflowTitle).toBe("Bibliotheks-Einrichtungsablauf");
    expect(translations.de.libraryVerifyTitle).toBe("Wiedergabebereitschaft pruefen");
    expect(translations.de.diagnosticsReadinessTotalTracks).toBe("Titel");
    expect(translations.de.diagnosticsReadinessMissingDuration).toBe("Dauer fehlt");
    expect(translations.de.diagnosticsReadinessMissingLoudness).toBe("Lautheit/Gain fehlt");
    expect(translations.de.diagnosticsReadinessMissingTrimSignals).toBe("Keine Trim-Signale");
    expect(translations.de.diagnosticsReadinessAnalysisErrors).toBe("Analysefehler");
    expect(translations.de.diagnosticsReadinessMissingWaveforms).toBe("Wellenformen fehlen");
  });

  it("preserves native display-board glyphs in German and Icelandic captions", () => {
    expect(translations.de.displayNextTanda).toContain("Nächstes");
    expect(translations.de.displaySinger).toContain("Sänger");
    expect(translations.is.displayNowTanda).toContain("Nú");
    expect(translations.is.displayNextTanda).toContain("Næst");
    expect(translations.is.displaySinger).toContain("Söngvari");
  });
});
