const allowedSortColumns = new Map([
  ["title", "title"],
  ["artist", "artist"],
  ["album", "album"],
  ["year", "year"],
  ["duration", "duration_ms"],
  ["start", "start_offset_ms"],
  ["end", "end_trim_ms"],
]);

export type SortColumn =
  | "title"
  | "artist"
  | "album"
  | "year"
  | "duration"
  | "start"
  | "end";

export type SortDirection = "asc" | "desc";

export const normalizeSortColumn = (column: string | undefined): SortColumn => {
  if (!column) {
    return "title";
  }
  return (allowedSortColumns.has(column) ? column : "title") as SortColumn;
};

export const normalizeSortDirection = (
  direction: string | undefined,
): SortDirection => {
  return direction === "desc" ? "desc" : "asc";
};

export const getSortSql = (column: SortColumn) => {
  return allowedSortColumns.get(column) ?? "title";
};

export const getSortKeySql = (column: SortColumn) => {
  const mapped = getSortSql(column);
  return `upper(coalesce(${mapped}, ''))`;
};

export const buildJumpIndex = (prefixes: string[]) => {
  const index = new Set<string>();
  prefixes.forEach((prefix) => {
    if (!prefix) {
      return;
    }
    if (/^[0-9]$/.test(prefix)) {
      index.add("0-9");
      return;
    }
    if (/^[A-Z]$/.test(prefix)) {
      index.add(prefix);
      return;
    }
    index.add("#");
  });
  const letters = Array.from(index).filter((value) => value.length === 1);
  letters.sort();
  const output = [];
  if (index.has("0-9")) {
    output.push("0-9");
  }
  output.push(...letters);
  if (index.has("#")) {
    output.push("#");
  }
  return output;
};
