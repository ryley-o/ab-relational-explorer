"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ProjectMeta } from "@/lib/projects/types";
import { useMarketData, meetsFilter, isFilterActive, type FilterState } from "@/lib/use-market-data";
import { LICENSE_META } from "@/lib/licenses";
import { FilterBar, PriceBadge, LicenseBadge } from "@/components/home/FilterBar";

interface ClusterProjectsViewProps {
  cluster: { id: string; label: string; description: string };
  members: Array<{ id: string; metadata: ProjectMeta }>;
  onCardClick: (nodeId: string) => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

export function ClusterProjectsView({ cluster, members, onCardClick, filters, onFiltersChange }: ClusterProjectsViewProps) {
  const market = useMarketData();
  const filterOn = isFilterActive(filters);

  const sorted = members.slice().sort((a, b) => {
    if (!filterOn) return 0;
    const am = meetsFilter(market.projects[a.id], filters, market.ethUsd) ? 0 : 1;
    const bm = meetsFilter(market.projects[b.id], filters, market.ethUsd) ? 0 : 1;
    return am - bm;
  });

  const matchCount = filterOn
    ? members.filter((n) => meetsFilter(market.projects[n.id], filters, market.ethUsd)).length
    : undefined;

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

      <div className="mb-8">
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

      <FilterBar
        filters={filters}
        onChange={onFiltersChange}
        matchCount={matchCount}
        totalCount={members.length}
        ethUsd={market.ethUsd}
      />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((node, ni) => {
          const entry = market.projects[node.id];
          const inRange = !filterOn || meetsFilter(entry, filters, market.ethUsd);
          return (
            <ProjectCard
              key={node.id}
              node={node}
              delay={ni * 0.035}
              onClick={() => onCardClick(node.id)}
              floorEth={entry?.floorEth}
              licenseCategory={entry?.licenseCategory}
              ethUsd={market.ethUsd}
              loading={market.loading}
              dimmed={!inRange}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

function ProjectCard({
  node,
  delay,
  onClick,
  floorEth,
  licenseCategory,
  ethUsd,
  loading,
  dimmed,
}: {
  node: { id: string; metadata: ProjectMeta };
  delay: number;
  onClick: () => void;
  floorEth: number | null | undefined;
  licenseCategory: string | undefined;
  ethUsd: number | null | undefined;
  loading: boolean;
  dimmed: boolean;
}) {
  const p = node.metadata;
  const year = new Date(p.startDatetime).getFullYear();
  const licMeta = licenseCategory ? LICENSE_META[licenseCategory as keyof typeof LICENSE_META] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: dimmed ? 0.3 : 1, y: 0 }}
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
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="font-mono text-[10px] text-ink-faint">{year}</span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <PriceBadge floorEth={floorEth} ethUsd={ethUsd} loading={loading} size="xs" />
            {licMeta && (
              <LicenseBadge category={licMeta.id} size="xs" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
