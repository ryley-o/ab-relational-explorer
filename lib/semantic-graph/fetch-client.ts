/**
 * Client-safe graph fetcher — loads /graph.json from the browser.
 * Strips raw embeddings and caches in module scope so the 19 MB file
 * is only downloaded once per browser session.
 */

import type { ClientGraph, ClientGraphNode, SemanticGraph } from "./types";

let _cache: ClientGraph<unknown> | null = null;
let _inflight: Promise<ClientGraph<unknown>> | null = null;

export async function fetchClientGraph<T = Record<string, unknown>>(): Promise<ClientGraph<T>> {
  if (_cache) return _cache as ClientGraph<T>;
  if (!_inflight) {
    _inflight = fetch("/graph.json")
      .then((r) => r.json())
      .then((raw: SemanticGraph<unknown>) => {
        _cache = {
          generatedAt: raw.generatedAt,
          clusters: raw.clusters,
          globalProjection: raw.globalProjection,
          nodes: raw.nodes.map(
            ({ embedding: _e, ...rest }) => rest as ClientGraphNode<unknown>,
          ),
        };
        return _cache;
      });
  }
  return _inflight as Promise<ClientGraph<T>>;
}
