/**
 * semantic-graph — runtime graph loading (server-only)
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { ClientGraph, ClientGraphNode, SemanticGraph } from "./types";

let _cached: SemanticGraph<unknown> | null = null;

export function loadFullGraph<T = Record<string, unknown>>(): SemanticGraph<T> {
  if (!_cached) {
    const path = join(process.cwd(), "public", "graph.json");
    try {
      _cached = JSON.parse(readFileSync(path, "utf-8")) as SemanticGraph<unknown>;
    } catch (err) {
      throw new Error(
        `public/graph.json not found or invalid. Run \`npm run build-graph\` first.\n${err}`,
      );
    }
  }
  return _cached as SemanticGraph<T>;
}

export function toClientGraph<T>(graph: SemanticGraph<T>): ClientGraph<T> {
  return {
    generatedAt: graph.generatedAt,
    clusters: graph.clusters,
    globalProjection: graph.globalProjection,
    nodes: graph.nodes.map(({ embedding: _embedding, ...rest }) => rest as ClientGraphNode<T>),
  };
}
