/**
 * Build the semantic graph from scraped project data.
 *
 * Usage:
 *   npm run build-graph
 *
 * Requires:
 *   VOYAGE_API_KEY   — Voyage AI embeddings
 *   ANTHROPIC_API_KEY — Claude cluster/axis labeling
 *
 * Reads:   data/projects.json
 * Writes:  public/graph.json
 * Cache:   .graph-cache/ (gitignored, speeds up re-runs)
 */

import "dotenv/config";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { buildSemanticGraph } from "../lib/semantic-graph/build";
import type { ContentItem } from "../lib/semantic-graph/types";
import type { ProjectMeta } from "../lib/projects/types";

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY is required");
if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

const projects: ProjectMeta[] = JSON.parse(
  readFileSync(join(process.cwd(), "data", "projects.json"), "utf-8"),
);

console.log(`Loaded ${projects.length} projects from data/projects.json`);

function buildEmbeddingText(p: ProjectMeta): string {
  const parts = [
    `Project: ${p.name}`,
    `Artist: ${p.artistName}`,
    `Description: ${p.description}`,
    `Vertical: ${p.vertical}`,
    `Script: ${p.scriptType}`,
  ];
  const relevantTags = p.tags.filter(
    (t) => !t.startsWith("curated series") && t !== "ab500",
  );
  if (relevantTags.length > 0) {
    parts.push(`Tags: ${relevantTags.join(", ")}`);
  }
  return parts.join("\n");
}

const items: ContentItem<ProjectMeta>[] = projects.map((p) => ({
  id: p.slug,
  embeddingText: buildEmbeddingText(p),
  imageUrl: p.featuredTokenImageUrl,
  metadata: p,
}));

const cacheDir = join(process.cwd(), ".graph-cache");
mkdirSync(cacheDir, { recursive: true });

const numClusters = Math.max(3, Math.round(projects.length / 4.5));
console.log(`Using ${numClusters} clusters for ${projects.length} projects`);

async function main() {
  const graph = await buildSemanticGraph(items, {
    voyageApiKey: VOYAGE_API_KEY!,
    anthropicApiKey: ANTHROPIC_API_KEY!,
    cacheDir,
    numClusters,
  });

  const outPath = join(process.cwd(), "public", "graph.json");
  mkdirSync(join(process.cwd(), "public"), { recursive: true });
  writeFileSync(outPath, JSON.stringify(graph));

  console.log(`\nWrote graph.json`);
  console.log(`  ${graph.nodes.length} nodes`);
  console.log(`  ${graph.clusters.length} clusters: ${graph.clusters.map((c) => c.label).join(", ")}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
