export const researchFields = ["title", "artist", "singer", "genre", "year", "bpm", "instrumental"] as const;
export type ResearchValues = Partial<Record<typeof researchFields[number], string | number | null>>;
export type ResearchTrack = Required<ResearchValues> & {
  id: string; album: string | null; duration: number | null; user_bpm: number | null; updated_at: string;
};
export type ResearchRow = {
  batch: string; line: number; id: string; original: Record<string, string>;
  snapshot: ResearchTrack | null; proposed: ResearchValues; approved: ResearchValues;
  draft?: ResearchValues;
  state: "pending" | "approved" | "rejected" | "reviewed" | "applied" | "undone";
  issues: string[]; conflict: boolean; importedAt: string; approvedAt?: string;
  appliedAt?: string; after?: ResearchTrack; undoneAt?: string;
};
export type ResearchEdit = {
  batch: string; line: number; state: "pending" | "approved" | "rejected"; values?: ResearchValues;
  recheck?: boolean; resolved?: boolean; allowNoChanges?: boolean;
};
export const requiresResearchResolution = (row: ResearchRow) =>
  /ambiguous|contradict|conflict|unresolved/i.test(row.original.review_status ?? "");
export type ResearchScope = "selected" | "filtered" | "genre" | "year" | "new" | "needed";
export type ResearchApi = {
  state(): Promise<{ rows: ResearchRow[]; needed: number; exported: number; completed: number }>;
  export(scope: ResearchScope, ids: string[], size: number, repeat: boolean): Promise<number>;
  import(): Promise<{ batch: string; duplicate: boolean } | null>;
  review(edits: ResearchEdit[]): Promise<void>;
  apply(): Promise<{ tracks: number; fields: number }>;
  undo(batch: string, line?: number): Promise<number>;
  prompt(): Promise<void>;
  evidence(url: string): Promise<void>;
};
