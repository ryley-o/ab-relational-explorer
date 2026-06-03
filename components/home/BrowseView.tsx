"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { ClientGraph, ClientGraphNode } from "@/lib/semantic-graph/types";
import type { ProjectMeta } from "@/lib/projects/types";

interface BrowseViewProps {
  graph: ClientGraph<ProjectMeta>;
  onCardClick: (nodeId: string) => void;
}

export function BrowseView({ graph, onCardClick }: BrowseViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full px-6 py-12 md:px-14 lg:px-20"
    >
      {/* Hero */}
      <div className="mb-16">
        <h1 className="text-5xl font-bold leading-[0.95] tracking-[-0.025em] text-ink md:text-6xl lg:text-7xl">
          Generative art,<br />related.
        </h1>
        <p className="mt-5 max-w-sm text-base leading-relaxed text-ink-dim">
          {graph.nodes.length} Art Blocks projects mapped by semantic similarity. Click any to explore the graph.
        </p>
      </div>

      {/* Cluster sections */}
      <div className="space-y-16">
        {graph.clusters.map((cluster, ci) => {
          const members = cluster.memberIds
            .map((id) => graph.nodes.find((n) => n.id === id) as ClientGraphNode<ProjectMeta> | undefined)
            .filter((n): n is ClientGraphNode<ProjectMeta> => n != null);

          const colClass =
            members.length === 1
              ? "grid-cols-1"
              : members.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

          return (
            <section key={cluster.id}>
              <div className="mb-4 flex items-center gap-4">
                <h2 className="shrink-0 font-mono font-light text-[10px] uppercase tracking-[0.24em] text-ink/80">
                  {cluster.label}
                </h2>
                <div className="h-px flex-1 bg-ink-faint/30" />
              </div>
              <p className="mb-7 max-w-lg text-sm leading-relaxed text-ink-dim">
                {cluster.description}
              </p>

              <div className={`grid gap-4 ${colClass}`}>
                {members.map((node, ni) => (
                  <ProjectCard
                    key={node.id}
                    node={node}
                    clusterLabel={cluster.label}
                    delay={ci * 0.06 + ni * 0.05}
                    onClick={() => onCardClick(node.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </motion.div>
  );
}

interface ProjectCardProps {
  node: ClientGraphNode<ProjectMeta>;
  clusterLabel: string;
  delay: number;
  onClick: () => void;
}

function ProjectCard({ node, clusterLabel, delay, onClick }: ProjectCardProps) {
  const p = node.metadata;
  const year = new Date(p.startDatetime).getFullYear();

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="group relative cursor-pointer rounded-xl border border-ink-faint/12 bg-canvas-raised/30 overflow-hidden transition-all duration-300 hover:border-ink-faint/25 hover:bg-canvas-raised/50"
    >
      {/* Preview image */}
      <div className="relative aspect-square overflow-hidden bg-canvas-raised">
        <Image
          src={p.featuredTokenImageUrl}
          alt={p.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          unoptimized
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-canvas/0 transition-colors duration-300 group-hover:bg-canvas/20" />
      </div>

      {/* Card body */}
      <div className="p-5">
        <p className="mb-2 font-mono font-light text-[9px] uppercase tracking-[0.22em] text-ink-dim">
          {clusterLabel}
        </p>
        <h3 className="text-base font-semibold leading-tight tracking-tight text-ink transition-colors duration-200 group-hover:text-accent">
          {p.name}
        </h3>
        <p className="mt-1 text-sm text-ink-dim">{p.artistName}</p>
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-ink-dim/70">
          {p.description}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-[10px] text-ink-faint">{year}</span>
          <span className="translate-x-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-70">
            Explore →
          </span>
        </div>
      </div>
    </motion.div>
  );
}
