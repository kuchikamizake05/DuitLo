export function activityListPage<T>(grouped: ReadonlyMap<string, T[]>, limit: number) {
  const entries = [...grouped].sort(([a], [b]) => b.localeCompare(a));
  const total = entries.reduce((sum, [, rows]) => sum + rows.length, 0);
  const groups: { date: string; rows: T[]; visibleRows: T[] }[] = [];
  let visible = 0;
  for (const [date, rows] of entries) {
    if (rows.length && visible >= limit) break;
    const visibleRows = rows.slice(0, Math.max(0, limit - visible));
    groups.push({ date, rows, visibleRows });
    visible += visibleRows.length;
  }
  return { groups, visible, total };
}
