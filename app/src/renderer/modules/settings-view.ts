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
