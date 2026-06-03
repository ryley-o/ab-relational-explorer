"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ClientGraph, ClientGraphNode, GraphCluster } from "@/lib/semantic-graph/types";
import type { ProjectMeta } from "@/lib/projects/types";

interface ClusterProjectsViewProps {
  graph: ClientGraph<ProjectMeta>;
  cluster: GraphCluster;
  onCardClick: (nodeId: string) => void;
}

export function ClusterProjectsView({ graph, cluster, onCardClick }: ClusterProjectsViewProps) {
  const members = cluster.memberIds
    .map((id) => graph.nodes.find((n) => n.id === id) as ClientGraphNode<ProjectMeta> | undefined)
    .filter((n): n is ClientGraphNode<ProjectMeta> => n != null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full px-6 py-12 md:px-14 lg:px-20"
    >
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-ink"
      >
        ← All collections
      </Link>

      <div className="mb-12">
        <h1 className="text-4xl font-bold leading-tight tracking-[-0.02em] text-ink md:text-5xl">
          {cluster.label}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-dim">
          {cluster.description}
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          {members.length} projects — click any to explore the relational graph
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((node, ni) => (
          <ProjectCard
            key={node.id}
            node={node}
            delay={ni * 0.035}
            onClick={() => onCardClick(node.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ProjectCard({
  node,
  delay,
  onClick,
}: {
  node: ClientGraphNode<ProjectMeta>;
  delay: number;
  onClick: () => void;
}) {
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
      <div className="relative aspect-square overflow-hidden bg-canvas-raised">
        <Image
          src={p.featuredTokenImageUrl}
          alt={p.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-canvas/0 transition-colors duration-300 group-hover:bg-canvas/20" />
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold leading-tight tracking-tight text-ink transition-colors group-hover:text-accent">
          {p.name}
        </h3>
        <p className="mt-1 text-xs text-ink-dim">{p.artistName}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[10px] text-ink-faint">{year}</span>
          <span className="translate-x-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-70">
            Explore →
          </span>
        </div>
      </div>
    </motion.div>
  );
}
