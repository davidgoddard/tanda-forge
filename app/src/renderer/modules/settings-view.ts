import type { OutputMode } from "../../shared/state/renderer-ui-store.js";

export const resolveOutputModeValue = (value: string): OutputMode => {
  if (value === "live") {
    return "live";
  }
  if (value === "edit") {
    return "edit";
  }
  return "prep";
};

export const activateSettingsTab = (
  buttons: Iterable<HTMLElement>,
  panels: Iterable<HTMLElement>,
  tab: string,
) => {
  Array.from(buttons).forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  Array.from(panels).forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tab === tab);
  });
};

export const pulseSettingsSection = (
  section: HTMLElement | null | undefined,
  timeoutMs = 5200,
) => {
  if (!section) {
    return;
  }
  section.classList.remove("section-pulse");
  void section.offsetWidth;
  section.classList.add("section-pulse");
  window.setTimeout(() => {
    section.classList.remove("section-pulse");
  }, timeoutMs);
};
