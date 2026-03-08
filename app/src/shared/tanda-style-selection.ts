import { normalizeStyleName } from "./tanda-utils.js";
import { splitStyleLabel } from "./style-families.js";

const normalizeBase = (value: string) => normalizeStyleName(value);

const isStyleInBase = (style: string, base: string) => {
  const normalizedStyle = normalizeStyleName(style);
  if (!normalizedStyle) {
    return false;
  }
  if (normalizedStyle === base) {
    return true;
  }
  return splitStyleLabel(normalizedStyle).base === base;
};

export const toggleTandaBaseStyle = (styles: string[], baseStyle: string) => {
  const base = normalizeBase(baseStyle);
  if (!base) {
    return styles;
  }
  const hasBase = styles.some((style) => isStyleInBase(style, base));
  const withoutBase = styles.filter((style) => !isStyleInBase(style, base));
  if (hasBase) {
    return withoutBase;
  }
  return [...withoutBase, base];
};

export const selectTandaVariantStyle = (
  styles: string[],
  baseStyle: string,
  variantStyle: string,
) => {
  const base = normalizeBase(baseStyle);
  const variant = normalizeStyleName(variantStyle);
  if (!base || !variant) {
    return styles;
  }
  const withoutBase = styles.filter((style) => !isStyleInBase(style, base));
  return [...withoutBase, variant];
};

