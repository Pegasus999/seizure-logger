import { shouldApplyRemote } from '../merge';

const T1 = '2026-10-30T01:00:00.000Z';
const T2 = '2026-10-30T02:00:00.000Z';

describe('shouldApplyRemote', () => {
  it('applies when there is no local row', () => {
    expect(shouldApplyRemote(null, T1)).toBe(true);
  });
  it('applies when local is clean, even if newer', () => {
    expect(shouldApplyRemote({ updated_at: T2, dirty: 0 }, T1)).toBe(true);
  });
  it('applies when local is dirty and older', () => {
    expect(shouldApplyRemote({ updated_at: T1, dirty: 1 }, T2)).toBe(true);
  });
  it('keeps local when dirty and newer', () => {
    expect(shouldApplyRemote({ updated_at: T2, dirty: 1 }, T1)).toBe(false);
  });
  it('applies when equal', () => {
    expect(shouldApplyRemote({ updated_at: T1, dirty: 1 }, T1)).toBe(true);
  });
});
