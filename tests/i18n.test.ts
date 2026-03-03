import { describe, expect, it } from "vitest";
import {
  SUPPORTED_LANGUAGES,
  translate,
  translations,
  type LanguageKey,
} from "../app/src/renderer/i18n";

describe("renderer i18n", () => {
  it("exposes all supported languages", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "es", "fr", "de", "pt", "it"]);
  });

  it("returns language key fallback when missing in all maps", () => {
    expect(translate("en", "__missing_key__")).toBe("__missing_key__");
  });

  it("falls back to english when key is missing in selected language", () => {
    const language = "es" as LanguageKey;
    const key = "audioDynamicsPathPending";
    const enValue = translations.en[key];
    expect(enValue).toBeTruthy();
    expect(translate(language, key)).toBe(enValue);
  });

  it("interpolates parameters in translated strings", () => {
    const value = translate("en", "audioDynamicsPathOriginal", {
      path: "/tmp/example.wav",
    });
    expect(value).toContain("/tmp/example.wav");
  });
});

