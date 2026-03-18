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
      "actionAddClipboardShort",
      "actionAddPlaylistShort",
      "actionAddTandaShort",
    ],
    [
      "actionEditTrackShort",
      "actionSearchShort",
      "actionAddPlaylistShort",
      "actionAddTandaShort",
      "actionMoveCollectionShort",
      "actionRemoveClipboardShort",
    ],
    [
      "actionEditTrackShort",
      "actionSearchShort",
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

  it("interpolates parameters in translated strings", () => {
    const value = translate("en", "audioDynamicsPathOriginal", {
      path: "/tmp/example.wav",
    });
    expect(value).toContain("/tmp/example.wav");
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
});
