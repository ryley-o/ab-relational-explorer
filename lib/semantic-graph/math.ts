/**
 * semantic-graph — pure math utilities
 *
 * No external dependencies. Works in Node.js and browser environments.
 */

export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

export function normalize(v: number[]): number[] {
  const n = norm(v);
  if (n === 0) return v.slice();
  return v.map((x) => x / n);
}

export function cosine(a: number[], b: number[]): number {
  return Math.min(1, Math.max(-1, dot(a, b)));
}

export function distSq(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

function addVec(acc: number[], v: number[]): void {
  for (let i = 0; i < v.length; i++) acc[i] += v[i];
}

function scaleVec(v: number[], s: number): number[] {
  return v.map((x) => x * s);
}

// ---------------------------------------------------------------------------
// K-means clustering (Lloyd's algorithm with k-means++ initialization)
// ---------------------------------------------------------------------------

function makePrng(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kmeansppInit(embeddings: number[][], k: number, rand: () => number): number[][] {
  const n = embeddings.length;
  const centroids: number[][] = [];
  centroids.push(embeddings[Math.floor(rand() * n)].slice());
  for (let c = 1; c < k; c++) {
    const dists = embeddings.map((e) => Math.min(...centroids.map((cen) => distSq(e, cen))));
    const total = dists.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (; idx < n - 1; idx++) {
      r -= dists[idx];
      if (r <= 0) break;
    }
    centroids.push(embeddings[idx].slice());
  }
  return centroids;
}

export interface KMeansResult {
  labels: number[];
  centroids: number[][];
  iterations: number;
  inertia: number;
}

function computeInertia(embeddings: number[][], labels: number[], centroids: number[][]): number {
  return embeddings.reduce((sum, e, i) => sum + distSq(e, centroids[labels[i]]), 0);
}

export function kmeans(
  embeddings: number[][],
  k: number,
  maxIter = 100,
  seed = 42,
  restarts = 10,
): KMeansResult {
  let best: KMeansResult | null = null;
  for (let r = 0; r < restarts; r++) {
    const result = kmeansOnce(embeddings, k, maxIter, seed + r);
    if (!best || result.inertia < best.inertia) best = result;
  }
  return best!;
}

function kmeansOnce(embeddings: number[][], k: number, maxIter = 100, seed = 42): KMeansResult {
  const n = embeddings.length;
  const d = embeddings[0].length;
  const rand = makePrng(seed);
  const centroids = kmeansppInit(embeddings, k, rand);
  let labels = new Array<number>(n).fill(0);

  let iter = 0;
  for (; iter < maxIter; iter++) {
    const newLabels = embeddings.map((e) => {
      let best = 0;
      let bestDist = distSq(e, centroids[0]);
      for (let c = 1; c < k; c++) {
        const d2 = distSq(e, centroids[c]);
        if (d2 < bestDist) { bestDist = d2; best = c; }
      }
      return best;
    });
    if (newLabels.every((l, i) => l === labels[i])) break;
    labels = newLabels;
    const newCentroids = Array.from({ length: k }, () => new Array<number>(d).fill(0));
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i++) {
      addVec(newCentroids[labels[i]], embeddings[i]);
      counts[labels[i]]++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) centroids[c] = scaleVec(newCentroids[c], 1 / counts[c]);
    }
  }

  const inertia = computeInertia(embeddings, labels, centroids);
  return { labels, centroids, iterations: iter, inertia };
}

export function softMembership(embeddings: number[][], centroids: number[][]): number[][] {
  return embeddings.map((e) => {
    const dists = centroids.map((c) => distSq(e, c));
    const invDists = dists.map((d) => 1 / (d + 1e-12));
    const total = invDists.reduce((a, b) => a + b, 0);
    return invDists.map((w) => w / total);
  });
}

// ---------------------------------------------------------------------------
// PCA via Gram matrix eigenvectors
// ---------------------------------------------------------------------------

function buildGram(embeddings: number[][]): { G: number[][]; mean: number[] } {
  const n = embeddings.length;
  const d = embeddings[0].length;
  const mean = new Array<number>(d).fill(0);
  for (const e of embeddings) addVec(mean, e);
  for (let j = 0; j < d; j++) mean[j] /= n;
  const X = embeddings.map((e) => e.map((v, j) => v - mean[j]));
  const G = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => dot(X[i], X[j])),
  );
  return { G, mean };
}

function powerIter(
  M: number[][],
  n: number,
  iters = 200,
  initVec?: number[],
): { vec: number[]; eigenvalue: number } {
  let v = initVec ?? Array.from({ length: n }, (_, i) => (i === 0 ? 1 : 0));
  v = normalize(v);
  let eigenvalue = 0;
  for (let it = 0; it < iters; it++) {
    const Mv = M.map((row) => dot(row, v));
    eigenvalue = dot(Mv, v);
    const n2 = norm(Mv);
    if (n2 < 1e-15) break;
    v = Mv.map((x) => x / n2);
  }
  return { vec: v, eigenvalue };
}

function deflate(M: number[][], v: number[], eigenvalue: number): number[][] {
  return M.map((row, i) => row.map((val, j) => val - eigenvalue * v[i] * v[j]));
}

export interface PCAResult {
  positions: Record<string, { x: number; y: number }>;
  u1: number[];
  u2: number[];
  norm1: number;
  norm2: number;
  nodeOrder: string[];
}

export function pca2(ids: string[], embeddings: number[][]): PCAResult {
  const n = embeddings.length;
  if (n === 0) throw new Error("pca2: need at least 1 item");
  if (n === 1) {
    return { positions: { [ids[0]]: { x: 0, y: 0 } }, u1: [1], u2: [1], norm1: 1, norm2: 1, nodeOrder: ids };
  }
  const { G } = buildGram(embeddings);
  const { vec: u1, eigenvalue: ev1 } = powerIter(G, n);
  const norm1 = Math.sqrt(Math.max(0, ev1));
  const G2 = deflate(G, u1, ev1);
  const { vec: u2, eigenvalue: ev2 } = powerIter(G2, n, 200, (() => {
    const seed = new Array<number>(n).fill(0);
    const maxIdx = u1.reduce((best, v, i) => (Math.abs(v) > Math.abs(u1[best]) ? i : best), 0);
    seed[(maxIdx + 1) % n] = 1;
    return seed;
  })());
  const norm2 = Math.sqrt(Math.max(0, ev2));
  const rawX = u1.map((v) => v * norm1);
  const rawY = u2.map((v) => v * norm2);
  const maxAbsX = Math.max(...rawX.map(Math.abs), 1e-9);
  const maxAbsY = Math.max(...rawY.map(Math.abs), 1e-9);
  const positions: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < n; i++) {
    positions[ids[i]] = { x: rawX[i] / maxAbsX, y: rawY[i] / maxAbsY };
  }
  return { positions, u1, u2, norm1, norm2, nodeOrder: ids };
}

export function scalePositions(
  positions: Record<string, { x: number; y: number }>,
  margin = 0.85,
): Record<string, { x: number; y: number }> {
  const xs = Object.values(positions).map((p) => p.x);
  const ys = Object.values(positions).map((p) => p.y);
  const maxAbsX = Math.max(...xs.map(Math.abs), 1e-9);
  const maxAbsY = Math.max(...ys.map(Math.abs), 1e-9);
  return Object.fromEntries(
    Object.entries(positions).map(([id, p]) => [
      id,
      { x: (p.x / maxAbsX) * margin, y: (p.y / maxAbsY) * margin },
    ]),
  );
}

// ---------------------------------------------------------------------------
// Similarity-radial layout
// ---------------------------------------------------------------------------

export interface SimilarityLayoutResult {
  positions: Record<string, { x: number; y: number }>;
  angularXScores: Array<{ id: string; score: number }>;
  angularYScores: Array<{ id: string; score: number }>;
}

export function buildSimilarityLayout(
  allIds: string[],
  allEmbeddings: number[][],
  memberIds: string[],
  memberEmbeddings: number[][],
  centroid: number[],
): SimilarityLayoutResult {
  const centroidHat = normalize(centroid);
  const dims = centroidHat.length;
  const numMembers = Math.max(memberEmbeddings.length, 1);
  const sims = allEmbeddings.map((e) => cosine(e, centroidHat));
  const residuals = allEmbeddings.map((e, i) => e.map((v, j) => v - sims[i] * centroidHat[j]));
  const memberSims = memberEmbeddings.map((e) => cosine(e, centroidHat));
  const memberResiduals = memberEmbeddings.map((e, i) => e.map((v, j) => v - memberSims[i] * centroidHat[j]));
  const G: number[][] = Array.from({ length: numMembers }, (_, i) =>
    Array.from({ length: numMembers }, (_, j) => dot(memberResiduals[i] ?? [], memberResiduals[j] ?? [])),
  );
  const { vec: u1, eigenvalue: ev1 } = powerIter(G, numMembers);
  const G2 = deflate(G, u1, ev1);
  const { vec: u2 } = powerIter(G2, numMembers);
  const a1 = new Array<number>(dims).fill(0);
  const a2 = new Array<number>(dims).fill(0);
  for (let i = 0; i < numMembers; i++) {
    const r = memberResiduals[i];
    if (!r) continue;
    for (let j = 0; j < dims; j++) { a1[j] += u1[i] * r[j]; a2[j] += u2[i] * r[j]; }
  }
  const rawAngX = residuals.map((r) => dot(r, a1));
  const rawAngY = residuals.map((r) => dot(r, a2));
  const maxAngX = Math.max(...rawAngX.map(Math.abs), 1e-9);
  const maxAngY = Math.max(...rawAngY.map(Math.abs), 1e-9);
  const normAngX = rawAngX.map((v) => v / maxAngX);
  const normAngY = rawAngY.map((v) => v / maxAngY);
  const simMin = Math.min(...sims);
  const simMax = Math.max(...sims);
  const simRange = simMax - simMin || 1;
  const radii = sims.map((s) => (simMax - s) / simRange);
  const scale = 0.9;
  const positions: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < allIds.length; i++) {
    const r = radii[i] * scale;
    const angMag = Math.sqrt(normAngX[i] ** 2 + normAngY[i] ** 2) || 1;
    positions[allIds[i]] = { x: r * (normAngX[i] / angMag), y: r * (normAngY[i] / angMag) };
  }
  return {
    positions,
    angularXScores: allIds.map((id, i) => ({ id, score: normAngX[i] })),
    angularYScores: allIds.map((id, i) => ({ id, score: normAngY[i] })),
  };
}

// ---------------------------------------------------------------------------
// Similarity utilities
// ---------------------------------------------------------------------------

export function topK(
  queryNorm: number[],
  items: Array<{ id: string; embeddingNorm: number[] }>,
  k: number,
  exclude?: Set<string>,
): Array<{ id: string; score: number }> {
  return items
    .filter((item) => !exclude?.has(item.id))
    .map((item) => ({ id: item.id, score: cosine(queryNorm, item.embeddingNorm) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
