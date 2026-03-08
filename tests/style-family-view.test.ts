import { describe, expect, it } from "vitest";
import {
  STYLE_FAMILY_EDIT_PULSE_CLASS,
  pulseStyleFamilyEditFields,
} from "../app/src/renderer/modules/style-family-view";

const makeField = () => {
  const classes = new Set<string>();
  return {
    classList: {
      add: (...tokens: string[]) => {
        tokens.forEach((token) => classes.add(token));
      },
      remove: (...tokens: string[]) => {
        tokens.forEach((token) => classes.delete(token));
      },
    },
    hasClass: (token: string) => classes.has(token),
  };
};

describe("pulseStyleFamilyEditFields", () => {
  it("adds pulse class immediately and removes it after delay callback", () => {
    const fieldA = makeField();
    const fieldB = makeField();
    let scheduled: (() => void) | null = null;
    pulseStyleFamilyEditFields(
      [fieldA, fieldB],
      (callback) => {
        scheduled = callback;
        return 0;
      },
      1000,
    );
    expect(fieldA.hasClass(STYLE_FAMILY_EDIT_PULSE_CLASS)).toBe(true);
    expect(fieldB.hasClass(STYLE_FAMILY_EDIT_PULSE_CLASS)).toBe(true);
    expect(scheduled).not.toBeNull();
    scheduled?.();
    expect(fieldA.hasClass(STYLE_FAMILY_EDIT_PULSE_CLASS)).toBe(false);
    expect(fieldB.hasClass(STYLE_FAMILY_EDIT_PULSE_CLASS)).toBe(false);
  });

  it("ignores null/duplicate fields safely", () => {
    const field = makeField();
    pulseStyleFamilyEditFields([null, field, field], () => 0, 1000);
    expect(field.hasClass(STYLE_FAMILY_EDIT_PULSE_CLASS)).toBe(true);
  });
});

