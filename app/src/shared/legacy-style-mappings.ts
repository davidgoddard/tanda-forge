import { normalizeStyleName } from "./tanda-utils.js";

export type LegacyStyleMappingState = Record<string, Record<string, string>>;

const normalizeRootKey = (rootPath: string) => rootPath.trim();

const normalizeLegacyValueKey = (legacyValue: string) => {
  const normalized = normalizeStyleName(legacyValue);
  if (normalized) {
    return normalized.toLowerCase();
  }
  return legacyValue.trim().toLowerCase();
};

export const getLegacyStyleMapping = (
  state: LegacyStyleMappingState,
  rootPath: string,
  legacyValue: string,
) => {
  const rootKey = normalizeRootKey(rootPath);
  const valueKey = normalizeLegacyValueKey(legacyValue);
  return state[rootKey]?.[valueKey] ?? "";
};

export const setLegacyStyleMapping = (
  state: LegacyStyleMappingState,
  rootPath: string,
  legacyValue: string,
  mappedStyle: string,
): LegacyStyleMappingState => {
  const rootKey = normalizeRootKey(rootPath);
  const valueKey = normalizeLegacyValueKey(legacyValue);
  if (!rootKey || !valueKey) {
    return state;
  }
  const next = { ...state };
  const currentRoot = { ...(next[rootKey] ?? {}) };
  const mapped = mappedStyle.trim();
  if (!mapped) {
    delete currentRoot[valueKey];
  } else {
    currentRoot[valueKey] = mapped;
  }
  if (Object.keys(currentRoot).length === 0) {
    delete next[rootKey];
  } else {
    next[rootKey] = currentRoot;
  }
  return next;
};

export const parseLegacyStyleMappingState = (raw: string | null | undefined) => {
  if (!raw) {
    return {} as LegacyStyleMappingState;
  }
  try {
    const parsed = JSON.parse(raw) as LegacyStyleMappingState;
    if (!parsed || typeof parsed !== "object") {
      return {} as LegacyStyleMappingState;
    }
    const output: LegacyStyleMappingState = {};
    Object.entries(parsed).forEach(([root, values]) => {
      if (!root || !values || typeof values !== "object") {
        return;
      }
      const normalizedRoot = root.trim();
      if (!normalizedRoot) {
        return;
      }
      const mapped: Record<string, string> = {};
      Object.entries(values).forEach(([legacyValue, style]) => {
        if (typeof style !== "string") {
          return;
        }
        const normalizedValue = legacyValue.trim().toLowerCase();
        const normalizedStyle = style.trim();
        if (!normalizedValue || !normalizedStyle) {
          return;
        }
        mapped[normalizedValue] = normalizedStyle;
      });
      if (Object.keys(mapped).length > 0) {
        output[normalizedRoot] = mapped;
      }
    });
    return output;
  } catch {
    return {} as LegacyStyleMappingState;
  }
};

