import type { IRequest } from './oa-types';
export function mergeRequests(current: IRequest[], incoming: IRequest[], removed: string[] = []): IRequest[] {
  const deleted = new Set(removed), rows = new Map<string,IRequest>();
  for (const row of current) if (!deleted.has(row.id)) rows.set(row.id,row);
  for (const row of incoming) if (!deleted.has(row.id)) rows.set(row.id,row);
  return [...rows.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
