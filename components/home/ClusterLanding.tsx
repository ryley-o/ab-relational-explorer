"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ClientGraph, GraphCluster } from "@/lib/semantic-graph/types";
import type { ProjectMeta } from "@/lib/projects/types";
import { useMarketData, meetsFilter, isFilterActive } from "@/lib/use-market-data";
import { useFilterState } from "@/lib/use-filter-state";
import { FilterBar } from "@/components/home/FilterBar";

interface ClusterLandingProps {
  graph: ClientGraph<ProjectMeta>;
}

export function ClusterLanding({ graph }: ClusterLandingProps) {
  const [filters, setFilters] = useFilterState();
  const market = useMarketData();
  const filterOn = isFilterActive(filters);

  const clusterMatches = new Map<string, { match: number; total: number }>();
  for (const cluster of graph.clusters) {
    let match = 0;
    for (const id of cluster.memberIds) {
      if (meetsFilter(market.projects[id], filters, market.ethUsd)) match++;
    }
    clusterMatches.set(cluster.id, { match, total: cluster.memberIds.length });
  }

  const totalMatch = filterOn
    ? graph.nodes.filter((n) => meetsFilter(market.projects[n.id], filters, market.ethUsd)).length
    : graph.nodes.length;

  const sortedClusters = graph.clusters.slice().sort((a, b) => {
    if (!filterOn) return 0;
    const am = clusterMatches.get(a.id)?.match ?? 0;
    const bm = clusterMatches.get(b.id)?.match ?? 0;
    return bm - am;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full px-6 py-12 md:px-14 lg:px-20"
    >
      <div className="mb-10">
        <h1 className="text-5xl font-bold leading-[0.95] tracking-[-0.025em] text-ink md:text-6xl lg:text-7xl">
          Generative art,<br />related.
        </h1>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-ink-dim">
          {graph.nodes.length} Art Blocks projects across {graph.clusters.length} collections.
        </p>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        matchCount={filterOn ? totalMatch : undefined}
        totalCount={filterOn ? graph.nodes.length : undefined}
        ethUsd={market.ethUsd}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sortedClusters.map((cluster, ci) => {
          const counts = clusterMatches.get(cluster.id) ?? { match: cluster.memberIds.length, total: cluster.memberIds.length };
          const dimmed = filterOn && counts.match === 0;
          return (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              graph={graph}
              delay={ci * 0.02}
              matchCount={filterOn ? counts.match : undefined}
              totalCount={counts.total}
              dimmed={dimmed}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

function ClusterCard({
  cluster,
  graph,
  delay,
  matchCount,
  totalCount,
  dimmed,
}: {
  cluster: GraphCluster;
  graph: ClientGraph<ProjectMeta>;
  delay: number;
  matchCount?: number;
  totalCount: number;
  dimmed: boolean;
}) {
  const previewNodes = cluster.memberIds
    .slice(0, 4)
    .map((id) => graph.nodes.find((n) => n.id === id))
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: dimmed ? 0.3 : 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/cluster/${encodeURIComponent(cluster.id)}`}
        className="group block rounded-xl border border-ink-faint/12 bg-canvas-raised/30 overflow-hidden transition-all duration-300 hover:border-ink-faint/25 hover:bg-canvas-raised/50"
      >
        <div className="grid grid-cols-2" style={{ aspectRatio: "1" }}>
          {[0, 1, 2, 3].map((i) => {
            const node = previewNodes[i];
            const meta = node?.metadata as ProjectMeta | undefined;
            return (
              <div key={i} className="relative overflow-hidden bg-canvas-raised">
                {meta && (
                  <Image
                    src={meta.featuredTokenImageUrl}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 17vw"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="font-mono font-light text-[9px] uppercase tracking-[0.22em] text-ink-dim">
              {totalCount} projects
            </p>
            {matchCount !== undefined && (
              <span className={[
                "rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em]",
                matchCount > 0 ? "bg-accent/12 text-accent/80" : "bg-ink-faint/10 text-ink-faint",
              ].join(" ")}>
                {matchCount} in range
              </span>
            )}
          </div>
          <h2 className="text-sm font-semibold leading-tight tracking-tight text-ink transition-colors group-hover:text-accent">
            {cluster.label}
          </h2>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-dim/70">
            {cluster.description}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
