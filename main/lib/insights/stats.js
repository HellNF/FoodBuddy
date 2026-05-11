'use strict';

function median(xs) {
  if (!xs || xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Deterministic PRNG so permutation tests / daily picks are reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(xs) {
  if (!xs || xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

// Average-rank (handles ties), then Pearson on ranks.
function rank(xs) {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1; // ranks are 1-based
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

function spearman(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  return pearson(rank(x.slice(0, n)), rank(y.slice(0, n)));
}

// Two-sided permutation test for a correlation-like statistic.
function permutationTest(x, y, corrFn, iters = 2000, seed = 1) {
  const n = Math.min(x.length, y.length);
  const xs = x.slice(0, n), ys = y.slice(0, n);
  const observed = corrFn(xs, ys);
  if (n < 4) return { stat: observed, pValue: 1 };
  const rng = mulberry32(seed);
  let extreme = 0;
  const perm = ys.slice();
  for (let it = 0; it < iters; it++) {
    // Fisher–Yates shuffle of `perm`
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    if (Math.abs(corrFn(xs, perm)) >= Math.abs(observed) - 1e-12) extreme++;
  }
  return { stat: observed, pValue: (extreme + 1) / (iters + 1) };
}

// Benjamini–Hochberg step-up. Returns which hypotheses survive at level q + adjusted q-values.
function benjaminiHochberg(pvalues, q = 0.1) {
  const m = pvalues.length;
  if (m === 0) return { survived: [], qValues: [] };
  const order = pvalues.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  // largest k such that p_(k) <= (k/m)*q
  let maxK = 0;
  for (let k = 1; k <= m; k++) {
    if (order[k - 1][0] <= (k / m) * q) maxK = k;
  }
  const survived = new Array(m).fill(false);
  for (let k = 0; k < maxK; k++) survived[order[k][1]] = true;
  // adjusted q-values (monotone from the top)
  const qv = new Array(m).fill(1);
  let running = 1;
  for (let k = m; k >= 1; k--) {
    const adj = Math.min(1, (order[k - 1][0] * m) / k);
    running = Math.min(running, adj);
    qv[order[k - 1][1]] = running;
  }
  return { survived, qValues: qv };
}

module.exports = { median, mean, mulberry32, pearson, spearman, rank, permutationTest, benjaminiHochberg };
