type PulsableElement = {
  classList: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
  };
};

export const STYLE_FAMILY_EDIT_PULSE_CLASS = "style-family-edit-pulse";
export const STYLE_FAMILY_EDIT_PULSE_MS = 1400;

export const pulseStyleFamilyEditFields = (
  fields: Array<PulsableElement | null | undefined>,
  schedule: (callback: () => void, delayMs: number) => unknown = (callback, delayMs) => {
    return window.setTimeout(callback, delayMs);
  },
  pulseMs = STYLE_FAMILY_EDIT_PULSE_MS,
) => {
  const uniqueFields = Array.from(
    new Set(fields.filter((field): field is PulsableElement => Boolean(field))),
  );
  if (uniqueFields.length === 0) {
    return;
  }
  uniqueFields.forEach((field) => {
    field.classList.remove(STYLE_FAMILY_EDIT_PULSE_CLASS);
    field.classList.add(STYLE_FAMILY_EDIT_PULSE_CLASS);
  });
  schedule(() => {
    uniqueFields.forEach((field) => {
      field.classList.remove(STYLE_FAMILY_EDIT_PULSE_CLASS);
    });
  }, pulseMs);
};

