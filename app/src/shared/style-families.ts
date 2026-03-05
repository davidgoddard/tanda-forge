import { normalizeStyleName } from "./tanda-utils.js";

export type StyleFamily = {
  code: string;
  base: string;
  variants: string[];
};

export type StyleFamilyMap = Record<string, string[]>;

const normalizeCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export const splitStyleLabel = (value: string) => {
  const normalized = normalizeStyleName(value);
  if (!normalized) {
    return { base: "", variant: "" };
  }
  const parts = normalized.split(/\s*-\s*/);
  const base = normalizeStyleName(parts[0] ?? "");
  const variant = normalizeStyleName(parts.slice(1).join(" - "));
  return { base, variant };
};

export const composeStyleLabel = (base: string, variant = "") => {
  const normalizedBase = normalizeStyleName(base);
  const normalizedVariant = normalizeStyleName(variant);
  if (!normalizedBase) {
    return "";
  }
  if (!normalizedVariant) {
    return normalizedBase;
  }
  return `${normalizedBase} - ${normalizedVariant}`;
};

export const parseStyleFamilies = (input: string): StyleFamily[] => {
  if (!input.trim()) {
    return [];
  }
  const rows: StyleFamily[] = [];
  const seen = new Set<string>();
  input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [left, right = ""] = line.split("=");
      const code = normalizeCode(left ?? "");
      if (!code || seen.has(code)) {
        return;
      }
      const [rawBase = "", rawVariants = ""] = right.split(":");
      const base = normalizeStyleName(rawBase);
      if (!base) {
        return;
      }
      const variants = rawVariants
        .split(/[;,/]+/)
        .map((value) => normalizeStyleName(value))
        .filter(Boolean)
        .filter((value) => value !== base);
      rows.push({
        code,
        base,
        variants: Array.from(new Set(variants)),
      });
      seen.add(code);
    });
  return rows;
};

export const serializeStyleFamilies = (families: StyleFamily[]) =>
  families
    .map((family) => {
      const code = normalizeCode(family.code);
      const base = normalizeStyleName(family.base);
      if (!code || !base) {
        return "";
      }
      const variants = Array.from(
        new Set(
          family.variants
            .map((value) => normalizeStyleName(value))
            .filter(Boolean)
            .filter((value) => value !== base),
        ),
      );
      if (variants.length === 0) {
        return `${code}=${base}`;
      }
      return `${code}=${base}:${variants.join(", ")}`;
    })
    .filter(Boolean)
    .join("\n");

export const styleFamilyMapFromFamilies = (families: StyleFamily[]): StyleFamilyMap => {
  const map: StyleFamilyMap = {};
  families.forEach((family) => {
    const code = normalizeCode(family.code);
    const base = normalizeStyleName(family.base);
    if (!code || !base) {
      return;
    }
    const styles = [base].concat(
      family.variants
        .map((variant) => composeStyleLabel(base, variant))
        .filter(Boolean),
    );
    map[code] = Array.from(new Set(styles));
  });
  return map;
};

export const deriveFamiliesFromStyles = (styles: string[]): StyleFamily[] => {
  const byBase = new Map<string, Set<string>>();
  styles.forEach((style) => {
    const { base, variant } = splitStyleLabel(style);
    if (!base) {
      return;
    }
    const bucket = byBase.get(base) ?? new Set<string>();
    if (variant) {
      bucket.add(variant);
    }
    byBase.set(base, bucket);
  });
  return Array.from(byBase.entries()).map(([base, variants]) => ({
    code: base.slice(0, 1).toUpperCase(),
    base,
    variants: Array.from(variants).sort((a, b) => a.localeCompare(b)),
  }));
};

export const buildFamilyStyleIndex = (styles: string[]) => {
  const index = new Map<string, string[]>();
  styles.forEach((style) => {
    const normalizedStyle = normalizeStyleName(style);
    if (!normalizedStyle) {
      return;
    }
    const { base } = splitStyleLabel(normalizedStyle);
    const key = base || normalizedStyle;
    const bucket = index.get(key) ?? [];
    if (!bucket.includes(normalizedStyle)) {
      bucket.push(normalizedStyle);
    }
    index.set(key, bucket);
  });
  return index;
};

export const expandStyleFilters = (
  filters: string[],
  familyIndex: Map<string, string[]>,
) => {
  if (!filters.length) {
    return [];
  }
  const expanded = new Set<string>();
  filters.forEach((filter) => {
    const normalized = normalizeStyleName(filter);
    if (!normalized) {
      return;
    }
    const family = familyIndex.get(splitStyleLabel(normalized).base || normalized);
    if (family && family.length > 0) {
      family.forEach((style) => expanded.add(style));
      return;
    }
    expanded.add(normalized);
  });
  return Array.from(expanded);
};

export const formatStylePillLabel = (style: string, families: StyleFamily[]) => {
  const normalizedStyle = normalizeStyleName(style);
  if (!normalizedStyle) {
    return "";
  }
  const { base, variant } = splitStyleLabel(normalizedStyle);
  if (!base || !variant) {
    return normalizedStyle;
  }
  const family = families.find(
    (item) => normalizeStyleName(item.base) === base,
  );
  const code = normalizeCode(family?.code ?? "");
  if (!code) {
    return normalizedStyle;
  }
  return `${code} - ${variant}`;
};
