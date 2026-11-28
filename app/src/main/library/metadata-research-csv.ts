export const researchBaseColumns = [
  "id", "title", "artist", "singer", "album", "year", "genre", "bpm", "duration",
] as const;

export const researchResultColumns = [
  "suggested_title", "suggested_artist", "suggested_singer", "suggested_genre",
  "suggested_style", "suggested_subgenre", "recording_year", "recording_date",
  "suggested_bpm", "vocal_status", "source_url", "confidence", "review_status", "notes",
] as const;

type CsvValue = string | number | null;

export function encodeResearchCsv(
  columns: readonly string[],
  rows: readonly Readonly<Record<string, CsvValue>>[],
): string {
  const encode = (value: CsvValue | undefined) => {
    const field = String(value ?? "");
    return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
  };
  return [
    columns.map(encode).join(","),
    ...rows.map((row) => columns.map((column) => encode(row[column])).join(",")),
  ].join("\r\n") + "\r\n";
}

export type ResearchCsvRow = { line: number; fields: string[]; error?: string };

export function parseResearchCsv(input: string): ResearchCsvRow[] {
  const csv = input.replace(/^\uFEFF/, "");
  const rows: ResearchCsvRow[] = [];
  let line = 1;
  let startLine = line;
  let fields: string[] = [];
  let field = "";
  let state: "field" | "quoted" | "closed" = "field";
  let error: string | undefined;

  const finishField = () => {
    fields.push(field);
    field = "";
    state = "field";
  };
  const finishRow = () => {
    finishField();
    rows.push({ line: startLine, fields, ...(error ? { error } : {}) });
    fields = [];
    error = undefined;
  };

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === "\r" || char === "\n") {
      const newline = char === "\r" && csv[i + 1] === "\n" ? "\r\n" : char;
      i += newline.length - 1;
      line++;
      if (state === "quoted") {
        field += newline;
      } else {
        finishRow();
        startLine = line;
      }
    } else if (state === "quoted") {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        state = "closed";
      } else {
        field += char;
      }
    } else if (char === ",") {
      finishField();
    } else if (state === "closed") {
      error ??= "Unexpected character after closing quote";
    } else if (char === '"' && field === "") {
      state = "quoted";
    } else {
      if (char === '"') error ??= "Unexpected quote in unquoted field";
      field += char;
    }
  }
  if (state === "quoted") error ??= "Unterminated quoted field";
  if (fields.length || field || state === "closed" || error) finishRow();
  return rows;
}
