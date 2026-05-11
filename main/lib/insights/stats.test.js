const { median, mulberry32, pearson, spearman } = require('./stats');

describe('median', () => {
  it('odd length', () => { expect(median([3, 1, 2])).toBe(2); });
  it('even length', () => { expect(median([1, 2, 3, 4])).toBe(2.5); });
  it('empty → null', () => { expect(median([])).toBe(null); });
});

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42); const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
});

describe('pearson', () => {
  it('perfect positive', () => { expect(pearson([1,2,3,4], [2,4,6,8])).toBeCloseTo(1, 10); });
  it('perfect negative', () => { expect(pearson([1,2,3,4], [4,3,2,1])).toBeCloseTo(-1, 10); });
  it('zero variance → 0', () => { expect(pearson([1,1,1], [1,2,3])).toBe(0); });
  it('known value', () => { expect(pearson([1,2,3,5], [2,1,4,3])).toBeCloseTo(0.5291502622, 6); });
});

describe('spearman', () => {
  it('monotonic non-linear → 1', () => { expect(spearman([1,2,3,4], [1,4,9,16])).toBeCloseTo(1, 10); });
  it('handles ties (average ranks)', () => { expect(spearman([1,2,2,3], [1,2,3,4])).toBeCloseTo(0.9486832981, 6); });
});
