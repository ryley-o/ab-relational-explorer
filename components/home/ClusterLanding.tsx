"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ClientGraph, GraphCluster } from "@/lib/semantic-graph/types";
import type { ProjectMeta } from "@/lib/projects/types";

interface ClusterLandingProps {
  graph: ClientGraph<ProjectMeta>;
}

export function ClusterLanding({ graph }: ClusterLandingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full px-6 py-12 md:px-14 lg:px-20"
    >
      <div className="mb-16">
        <h1 className="text-5xl font-bold leading-[0.95] tracking-[-0.025em] text-ink md:text-6xl lg:text-7xl">
          Generative art,<br />related.
        </h1>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-ink-dim">
          {graph.nodes.length} Art Blocks projects across {graph.clusters.length} collections. Choose a collection to explore.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {graph.clusters.map((cluster, ci) => (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            graph={graph}
            delay={ci * 0.02}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ClusterCard({
  cluster,
  graph,
  delay,
}: {
  cluster: GraphCluster;
  graph: ClientGraph<ProjectMeta>;
  delay: number;
}) {
  const previewNodes = cluster.memberIds
    .slice(0, 4)
    .map((id) => graph.nodes.find((n) => n.id === id))
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/cluster/${encodeURIComponent(cluster.id)}`}
        className="group block rounded-xl border border-ink-faint/12 bg-canvas-raised/30 overflow-hidden transition-all duration-300 hover:border-ink-faint/25 hover:bg-canvas-raised/50"
      >
        {/* 2×2 image preview */}
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
          <p className="mb-1.5 font-mono font-light text-[9px] uppercase tracking-[0.22em] text-ink-dim">
            {cluster.memberIds.length} projects
          </p>
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
