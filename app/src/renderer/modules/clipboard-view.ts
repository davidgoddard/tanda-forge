export const normalizeClipboardFilter = (value: string) => value.trim().toLowerCase();

export const buildClipboardTandaFilterText = (params: {
  tandaName: string;
  styles: string[];
  trackIds: Array<string | null>;
  resolveTrackText: (trackId: string) => string | null;
}) => {
  const parts: string[] = [];
  if (params.tandaName) {
    parts.push(params.tandaName);
  }
  if (params.styles.length > 0) {
    parts.push(params.styles.join(" "));
  }
  params.trackIds.forEach((trackId) => {
    if (!trackId) {
      return;
    }
    const trackText = params.resolveTrackText(trackId);
    if (trackText) {
      parts.push(trackText);
    }
  });
  return parts.join(" ").toLowerCase();
};
