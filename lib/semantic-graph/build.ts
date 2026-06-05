/**
 * semantic-graph — build pipeline (server-only, Node.js)
 *
 * Accepts ContentItem<T>[], runs embedding → clustering → projection → labeling,
 * and returns a SemanticGraph<T> ready to be written to public/graph.json.
 */

import { embedMultimodal } from "./embed";
import { createLabelClient, disambiguateClusters, labelAxis, labelCluster } from "./label";
import {
  buildSimilarityLayout,
  distSq,
  kmeans,
  normalize,
  pca2,
  softMembership,
  topK,
} from "./math";
import type {
  BuildConfig,
  ContentItem,
  GraphCluster,
  GraphNode,
  GraphNodeLink,
  Projection,
  SemanticGraph,
} from "./types";

const POLE_COUNT = Math.min(3, 5);

function getPoleItems(
  ids: string[],
  scores: number[],
  metaMap: Map<string, { title: string; description: string }>,
  n: number,
): { negative: Array<{ title: string; description: string }>; positive: Array<{ title: string; description: string }> } {
  const sorted = ids.map((id, i) => ({ id, score: scores[i] })).sort((a, b) => a.score - b.score);
  const toDesc = (items: typeof sorted) =>
    items.map((item) => metaMap.get(item.id) ?? { title: item.id, description: "" }).filter((d) => d.description !== "");
  return { negative: toDesc(sorted.slice(0, n)), positive: toDesc(sorted.slice(-n).reverse()) };
}

async function buildProjection(
  memberIds: string[],
  allIds: string[],
  allEmbeddings: number[][],
  memberEmbeddings: number[][],
  metaMap: Map<string, { title: string; description: string }>,
  labelClient: ReturnType<typeof createLabelClient>,
): Promise<Projection> {
  const pcaResult = pca2(memberIds, memberEmbeddings);
  const allPositionsRaw: Record<string, { x: number; y: number }> = {};
  const n = memberIds.length;
  const { u1, u2, norm1, norm2 } = pcaResult;

  const rawAllScores: Array<{ id: string; x: number; y: number }> = allIds.map((id, idx) => {
    const q = allEmbeddings[idx];
    const Xq = memberEmbeddings.map((xi) => { let s = 0; for (let k = 0; k < xi.length; k++) s += xi[k] * q[k]; return s; });
    let x = 0; let y = 0;
    for (let i = 0; i < n; i++) { x += Xq[i] * u1[i]; y += Xq[i] * u2[i]; }
    return { id, x, y };
  });

  const maxAbsX = Math.max(...rawAllScores.map((s) => Math.abs(s.x)), 1e-9);
  const maxAbsY = Math.max(...rawAllScores.map((s) => Math.abs(s.y)), 1e-9);
  const scale = 0.9;

  for (const { id, x, y } of rawAllScores) {
    allPositionsRaw[id] = {
      x: Math.max(-1, Math.min(1, (x / maxAbsX) * scale)),
      y: Math.max(-1, Math.min(1, (y / maxAbsY) * scale)),
    };
  }

  const memberXScores = memberIds.map((id) => allPositionsRaw[id].x);
  const memberYScores = memberIds.map((id) => allPositionsRaw[id].y);
  const xPoles = getPoleItems(memberIds, memberXScores, metaMap, POLE_COUNT);
  const yPoles = getPoleItems(memberIds, memberYScores, metaMap, POLE_COUNT);

  const [xAxis, yAxis] = await Promise.all([
    labelAxis(xPoles.negative, xPoles.positive, labelClient.client, labelClient.cache),
    labelAxis(yPoles.negative, yPoles.positive, labelClient.client, labelClient.cache),
  ]);

  return {
    axes: { x: xAxis, y: yAxis },
    positions: allPositionsRaw,
    basis: { u1, u2, norm1, norm2, nodeOrder: memberIds },
  };
}

export async function buildSemanticGraph<T>(
  items: ContentItem<T>[],
  config: BuildConfig,
): Promise<SemanticGraph<T>> {
  const { voyageApiKey, anthropicApiKey, cacheDir, numClusters, randomSeed = 42 } = config;

  console.log(`Building semantic graph for ${items.length} items…`);

  console.log("Step 1: Embedding (multimodal: text + image)…");
  const rawEmbeddings = await embedMultimodal(
    items.map((item) => ({ text: item.embeddingText, imageUrl: item.imageUrl })),
    voyageApiKey,
    cacheDir,
  );
  const normalizedEmbeddings = rawEmbeddings.map(normalize);
  const ids = items.map((item) => item.id);

  const k = Math.min(numClusters, Math.floor(items.length / 2));
  console.log(`Step 2: K-means (k=${k}, 10 restarts)…`);
  const kmeansResult = kmeans(normalizedEmbeddings, k, 100, randomSeed, 10);
  const { labels: rawLabels, centroids } = kmeansResult;

  const labels = rawLabels.slice();
  const sizes = () => { const s = new Array<number>(k).fill(0); for (const l of labels) s[l]++; return s; };
  {
    const s = sizes();
    for (let c = 0; c < k; c++) {
      if (s[c] === 1) {
        for (let i = 0; i < labels.length; i++) {
          if (labels[i] === c) {
            let bestAlt = -1; let bestDist = Infinity;
            for (let alt = 0; alt < k; alt++) {
              if (alt === c || s[alt] === 0) continue;
              const d = distSq(normalizedEmbeddings[i], centroids[alt]);
              if (d < bestDist) { bestDist = d; bestAlt = alt; }
            }
            if (bestAlt >= 0) { labels[i] = bestAlt; s[bestAlt]++; s[c]--; }
          }
        }
      }
    }
  }

  const finalSizes = sizes();
  console.log(`  Distribution: ${finalSizes.join(" / ")} members per cluster`);

  const weights = softMembership(normalizedEmbeddings, centroids);

  const metaMap = new Map<string, { title: string; description: string }>();
  for (const item of items) {
    const meta = item.metadata as Record<string, unknown>;
    metaMap.set(item.id, {
      title: (meta.title as string | undefined) ?? (meta.name as string | undefined) ?? item.id,
      description: item.embeddingText,
    });
  }

  const labelClient = createLabelClient(anthropicApiKey, cacheDir);

  console.log("Step 3: Building cluster projections and labels…");
  const activeClusters: Array<{ idx: number; memberIdxs: number[] }> = [];
  for (let c = 0; c < k; c++) {
    const memberIdxs = labels.map((l, i) => (l === c ? i : -1)).filter((i) => i !== -1);
    if (memberIdxs.length > 0) activeClusters.push({ idx: c, memberIdxs });
  }
  console.log(`  Active clusters: ${activeClusters.length}`);

  const clusters: GraphCluster[] = [];
  const labelToClusterId = new Map<number, string>();

  for (const { idx: c, memberIdxs } of activeClusters) {
    const clusterSeqId = `c-0${clusters.length}`;
    labelToClusterId.set(c, clusterSeqId);

    const memberIds = memberIdxs.map((i) => ids[i]);
    const memberEmbeddings = memberIdxs.map((i) => normalizedEmbeddings[i]);

    console.log(`  ${clusterSeqId}: ${memberIds.length} members`);

    const layoutResult = buildSimilarityLayout(ids, normalizedEmbeddings, memberIds, memberEmbeddings, centroids[c]);

    const xPoles = getPoleItems(
      layoutResult.angularXScores.map((s) => s.id),
      layoutResult.angularXScores.map((s) => s.score),
      metaMap, POLE_COUNT,
    );
    const yPoles = getPoleItems(
      layoutResult.angularYScores.map((s) => s.id),
      layoutResult.angularYScores.map((s) => s.score),
      metaMap, POLE_COUNT,
    );
    const [xAxis, yAxis] = await Promise.all([
      labelAxis(xPoles.negative, xPoles.positive, labelClient.client, labelClient.cache),
      labelAxis(yPoles.negative, yPoles.positive, labelClient.client, labelClient.cache),
    ]);

    const projection = { axes: { x: xAxis, y: yAxis }, positions: layoutResult.positions };

    const memberDescs = memberIds.map((id) => metaMap.get(id) ?? { title: id, description: "" });
    const clusterLabelResult = await labelCluster(memberDescs, labelClient.client, labelClient.cache);

    clusters.push({
      id: clusterSeqId,
      label: clusterLabelResult.label,
      description: clusterLabelResult.description,
      memberIds,
      centroid: centroids[c],
      projection,
    });
  }

  console.log("Step 3b: Disambiguating cluster labels…");
  const disambigActions = await disambiguateClusters(
    clusters.map((c) => ({ id: c.id, label: c.label, description: c.description })),
    labelClient.client,
    labelClient.cache,
  );

  if (disambigActions.length === 0) {
    console.log("  No changes needed.");
  } else {
    // Apply renames first (no structural changes)
    for (const action of disambigActions) {
      if (action.action !== "rename") continue;
      const cluster = clusters.find((c) => c.id === action.id);
      if (!cluster) { console.log(`  rename ${action.id}: not found, skipping`); continue; }
      cluster.label = action.label;
      cluster.description = action.description;
      console.log(`  rename ${action.id} → "${action.label}"`);
    }

    // Apply merges (structural: reassign labels, rebuild projection, remove dropped cluster)
    for (const action of disambigActions) {
      if (action.action !== "merge") continue;
      const keepCluster = clusters.find((c) => c.id === action.keepId);
      const dropCluster = clusters.find((c) => c.id === action.dropId);
      if (!keepCluster || !dropCluster) {
        console.log(`  merge ${action.dropId}→${action.keepId}: cluster not found, skipping`);
        continue;
      }

      // Find k-means indices via labelToClusterId
      let keepKIdx = -1; let dropKIdx = -1;
      for (const [kIdx, cId] of labelToClusterId.entries()) {
        if (cId === action.keepId) keepKIdx = kIdx;
        if (cId === action.dropId) dropKIdx = kIdx;
      }
      if (keepKIdx === -1 || dropKIdx === -1) {
        console.log(`  merge ${action.dropId}→${action.keepId}: k-means index not found, skipping`);
        continue;
      }

      // Reassign raw k-means labels so node building maps drop→keep
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] === dropKIdx) labels[i] = keepKIdx;
      }

      // Fold soft-membership weights for drop into keep
      for (let i = 0; i < weights.length; i++) {
        weights[i][keepKIdx] += weights[i][dropKIdx];
        weights[i][dropKIdx] = 0;
      }

      // Merge activeClusters entries (keep arrays in sync with clusters array)
      const keepActiveIdx = activeClusters.findIndex(({ idx }) => idx === keepKIdx);
      const dropActiveIdx = activeClusters.findIndex(({ idx }) => idx === dropKIdx);
      if (keepActiveIdx >= 0 && dropActiveIdx >= 0) {
        activeClusters[keepActiveIdx].memberIdxs = [
          ...activeClusters[keepActiveIdx].memberIdxs,
          ...activeClusters[dropActiveIdx].memberIdxs,
        ];
        activeClusters.splice(dropActiveIdx, 1);
        // clusters[i] corresponds to activeClusters[i], so remove at same index
        clusters.splice(dropActiveIdx, 1);
      }

      // Update keep cluster: merged members, new label/description, rebuilt projection
      const mergedMemberIds = [...keepCluster.memberIds, ...dropCluster.memberIds];
      keepCluster.memberIds = mergedMemberIds;
      keepCluster.label = action.label;
      keepCluster.description = action.description;

      const mergedMemberIdxs = mergedMemberIds.map((id) => ids.indexOf(id)).filter((i) => i >= 0);
      const mergedMemberEmbeddings = mergedMemberIdxs.map((i) => normalizedEmbeddings[i]);
      const mergedLayoutResult = buildSimilarityLayout(
        ids, normalizedEmbeddings, mergedMemberIds, mergedMemberEmbeddings, centroids[keepKIdx],
      );
      const mergedXPoles = getPoleItems(
        mergedLayoutResult.angularXScores.map((s) => s.id),
        mergedLayoutResult.angularXScores.map((s) => s.score),
        metaMap, POLE_COUNT,
      );
      const mergedYPoles = getPoleItems(
        mergedLayoutResult.angularYScores.map((s) => s.id),
        mergedLayoutResult.angularYScores.map((s) => s.score),
        metaMap, POLE_COUNT,
      );
      const [mergedXAxis, mergedYAxis] = await Promise.all([
        labelAxis(mergedXPoles.negative, mergedXPoles.positive, labelClient.client, labelClient.cache),
        labelAxis(mergedYPoles.negative, mergedYPoles.positive, labelClient.client, labelClient.cache),
      ]);
      keepCluster.projection = { axes: { x: mergedXAxis, y: mergedYAxis }, positions: mergedLayoutResult.positions };

      console.log(`  merge ${action.dropId}→${action.keepId}: "${action.label}" (${mergedMemberIds.length} members)`);
    }
  }

  console.log(`  Final clusters: ${clusters.length} (${clusters.map((c) => c.label).join(", ")})`);

  console.log("Step 4: Building global projection…");
  const globalProjection = await buildProjection(ids, ids, normalizedEmbeddings, normalizedEmbeddings, metaMap, labelClient);

  labelClient.flush();

  console.log("Step 5: Computing similar-node edges…");
  const nodes: GraphNode<T>[] = items.map((item, idx) => {
    const embNorm = normalizedEmbeddings[idx];
    const clusterLabel = labelToClusterId.get(labels[idx]) ?? clusters[0]?.id ?? "c-00";
    const allItems = items.map((it, i) => ({ id: it.id, embeddingNorm: normalizedEmbeddings[i] }));

    const sameCluster = allItems.filter(
      (it) => it.id !== item.id && labels[items.findIndex((x) => x.id === it.id)] === labels[idx],
    );
    const nearLinks: GraphNodeLink[] = topK(embNorm, sameCluster, 2).map((r) => ({ ...r, kind: "near" as const }));

    const diffCluster = allItems.filter(
      (it) => it.id !== item.id && labels[items.findIndex((x) => x.id === it.id)] !== labels[idx],
    );
    const bridgeLinks: GraphNodeLink[] = topK(embNorm, diffCluster, 1).map((r) => ({ ...r, kind: "bridge" as const }));

    const allLinks = [...nearLinks, ...bridgeLinks];
    if (allLinks.length < 3) {
      const usedIds = new Set([item.id, ...allLinks.map((l) => l.id)]);
      const fillLinks = topK(embNorm, allItems, 3 - allLinks.length, usedIds).map((r) => ({ ...r, kind: "near" as const }));
      allLinks.push(...fillLinks);
    }

    const membershipWeights = weights[idx];
    const clusterMemberships = activeClusters.map(({ idx: kIdx }, seqIdx) => ({
      clusterId: clusters[seqIdx].id,
      weight: membershipWeights[kIdx],
    }));
    const weightTotal = clusterMemberships.reduce((s, m) => s + m.weight, 0);
    if (weightTotal > 0) for (const m of clusterMemberships) m.weight /= weightTotal;

    return {
      id: item.id,
      embedding: normalizedEmbeddings[idx],
      metadata: item.metadata,
      primaryClusterId: clusterLabel,
      clusterMemberships,
      similar: allLinks.slice(0, 3),
    };
  });

  console.log("✓ Graph built.");
  return { generatedAt: new Date().toISOString(), nodes, clusters, globalProjection };
}
