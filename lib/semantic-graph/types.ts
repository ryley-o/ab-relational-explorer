/**
 * semantic-graph — core types
 *
 * Generalized over the content metadata type T so this library can be used
 * with any corpus. The build pipeline accepts ContentItem<T> and produces
 * SemanticGraph<T>; the client receives ClientGraph<T> (same, but with raw
 * embeddings stripped).
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ContentItem<T = Record<string, unknown>> {
  id: string;
  embeddingText: string;
  /** Optional image URL — when provided, embeddings use voyage-multimodal-3 (text + image). */
  imageUrl?: string;
  metadata: T;
}

// ---------------------------------------------------------------------------
// Projections & axes
// ---------------------------------------------------------------------------

export interface AxisLabel {
  name: string;
  negative: string;
  positive: string;
}

export interface Projection {
  axes: { x: AxisLabel; y: AxisLabel };
  positions: Record<string, { x: number; y: number }>;
  basis?: {
    u1: number[];
    u2: number[];
    norm1: number;
    norm2: number;
    nodeOrder: string[];
  };
}

// ---------------------------------------------------------------------------
// Graph nodes & clusters
// ---------------------------------------------------------------------------

export interface GraphNodeLink {
  id: string;
  score: number;
  kind: "near" | "bridge";
}

export interface ClusterMembership {
  clusterId: string;
  weight: number;
}

export interface GraphNode<T = Record<string, unknown>> {
  id: string;
  embedding: number[];
  metadata: T;
  primaryClusterId: string;
  clusterMemberships: ClusterMembership[];
  similar: GraphNodeLink[];
}

export interface GraphCluster {
  id: string;
  label: string;
  description: string;
  memberIds: string[];
  centroid: number[];
  projection: Projection;
}

// ---------------------------------------------------------------------------
// Full graph (server-side, includes embeddings)
// ---------------------------------------------------------------------------

export interface SemanticGraph<T = Record<string, unknown>> {
  generatedAt: string;
  nodes: GraphNode<T>[];
  clusters: GraphCluster[];
  globalProjection: Projection;
}

// ---------------------------------------------------------------------------
// Client graph (browser-safe, embeddings stripped)
// ---------------------------------------------------------------------------

export type ClientGraphNode<T = Record<string, unknown>> = Omit<GraphNode<T>, "embedding">;

export interface ClientGraph<T = Record<string, unknown>> {
  generatedAt: string;
  nodes: ClientGraphNode<T>[];
  clusters: GraphCluster[];
  globalProjection: Projection;
}

// ---------------------------------------------------------------------------
// Build config
// ---------------------------------------------------------------------------

export interface BuildConfig {
  voyageApiKey: string;
  anthropicApiKey: string;
  cacheDir: string;
  numClusters: number;
  randomSeed?: number;
}
