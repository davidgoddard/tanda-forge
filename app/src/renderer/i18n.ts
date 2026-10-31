import { en } from "./locales/en.js";
import { es } from "./locales/es.js";
import { fr } from "./locales/fr.js";
import { de } from "./locales/de.js";
import { pt } from "./locales/pt.js";
import { it } from "./locales/it.js";
import { is } from "./locales/is.js";

export type LanguageKey = "en" | "es" | "fr" | "de" | "pt" | "it" | "is";
export const translations = { en, es, fr, de, pt, it, is };
export const SUPPORTED_LANGUAGES: LanguageKey[] = ["en", "es", "fr", "de", "pt", "it", "is"];

export const translate = (
  language: LanguageKey,
  key: string,
  params?: Record<string, string | number>,
) => {
  const rawValue = translations[language]?.[key] ?? translations.en[key] ?? key;
  const value = typeof rawValue === "string" ? rawValue : key;
  if (!params) return value;
  return Object.entries(params).reduce(
    (acc, [paramKey, paramValue]) => acc.replace(`{${paramKey}}`, String(paramValue)),
    value,
  );
};
