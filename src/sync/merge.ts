/**
 * Last-write-wins decision for a pulled row.
 * Apply when there is no local row, the local row is clean, or the remote
 * updated_at is >= the local updated_at (ISO strings compare lexicographically).
 */
export function shouldApplyRemote(
  local: { updated_at: string; dirty: number } | null,
  remoteUpdatedAt: string,
): boolean {
  if (!local) return true;
  if (!local.dirty) return true;
  return remoteUpdatedAt >= local.updated_at;
}
