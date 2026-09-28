export type ListParams = { page?: string; q?: string; status?: string };

export const ADMIN_PAGE_SIZE = 25;

/** Parses list query params; `q` is stripped of characters that would break PostgREST filters. */
export function parseListParams<S extends string>(params: ListParams, statuses: readonly S[] = []) {
  const page = Math.max(0, Number.parseInt(params.page ?? "0", 10) || 0);
  const q = (params.q ?? "").trim().replace(/[%,()*\\]/g, "").slice(0, 100);
  const status = statuses.find((s) => s === params.status);
  const from = page * ADMIN_PAGE_SIZE;
  return { page, q, status, from, to: from + ADMIN_PAGE_SIZE - 1, pageSize: ADMIN_PAGE_SIZE };
}
