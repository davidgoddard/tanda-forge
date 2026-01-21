export type SearchFilters = {
  query: string;
  styles: string[];
};

export const buildSearchWhere = (filters: SearchFilters) => {
  const where: string[] = [];
  const values: unknown[] = [];

  const query = filters.query.trim();
  if (query) {
    const like = `%${query}%`;
    where.push("(title like ? or artist like ? or album like ?)");
    values.push(like, like, like);
  }

  if (filters.styles.length > 0) {
    const placeholders = filters.styles.map(() => "?").join(", ");
    where.push(`genre in (${placeholders})`);
    values.push(...filters.styles);
  }

  return {
    whereSql: where.length ? `where ${where.join(" and ")}` : "",
    values,
  };
};
