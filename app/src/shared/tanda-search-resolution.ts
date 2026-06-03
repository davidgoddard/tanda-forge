export const resolveSearchResultTanda = <T>(params: {
  cached: T | null | undefined;
  clipboard: T | null | undefined;
  draft: T | null | undefined;
}) => params.cached ?? params.clipboard ?? params.draft ?? null;
