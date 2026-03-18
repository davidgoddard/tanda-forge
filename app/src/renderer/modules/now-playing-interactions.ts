export const shouldIgnoreNowPlayingSectionClick = (target: EventTarget | null) => {
  if (
    typeof target !== "object" ||
    target === null ||
    !("closest" in target) ||
    typeof (target as { closest?: unknown }).closest !== "function"
  ) {
    return false;
  }
  const element = target as { closest: (selector: string) => unknown };
  return Boolean(
    element.closest("button") ||
      element.closest(".now-playing-boost") ||
      element.closest("#cortina-controls") ||
      element.closest("#waveform-container") ||
      element.closest("#track-editor-waveform-container"),
  );
};
