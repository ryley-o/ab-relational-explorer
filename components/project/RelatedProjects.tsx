import Link from "next/link";
import Image from "next/image";
import type { ClientGraph, ClientGraphNode } from "@/lib/semantic-graph/types";
import type { ProjectMeta } from "@/lib/projects/types";

interface RelatedProjectsProps {
  slug: string;
  graph: ClientGraph<ProjectMeta>;
}

export function RelatedProjects({ slug, graph }: RelatedProjectsProps) {
  const node = graph.nodes.find((n) => n.id === slug) as
    | ClientGraphNode<ProjectMeta>
    | undefined;

  if (!node || node.similar.length === 0) return null;

  const primaryCluster = graph.clusters.find((c) => c.id === node.primaryClusterId);

  return (
    <div>
      <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
        related projects
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {node.similar.map((link) => {
          const related = graph.nodes.find((n) => n.id === link.id) as
            | ClientGraphNode<ProjectMeta>
            | undefined;
          if (!related) return null;

          const relatedCluster = graph.clusters.find((c) => c.id === related.primaryClusterId);
          const isBridge = link.kind === "bridge";
          const p = related.metadata;

          return (
            <Link
              key={link.id}
              href={`/project/${link.id}`}
              className="group block rounded-xl border border-ink-faint/20 bg-canvas-raised/60 overflow-hidden transition-colors hover:border-ink-faint/50 hover:bg-canvas-raised"
            >
              {/* Mini preview */}
              <div className="relative aspect-square overflow-hidden bg-canvas-raised">
                <Image
                  src={p.featuredTokenImageUrl}
                  alt={p.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 33vw"
                  unoptimized
                />
              </div>

              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isBridge ? "bg-accent" : "bg-ink-faint"}`}
                  />
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
                    {isBridge
                      ? `from · ${relatedCluster?.label ?? "other cluster"}`
                      : `more · ${primaryCluster?.label ?? "this cluster"}`}
                  </span>
                </div>
                <h3 className="font-semibold text-sm leading-snug tracking-tight text-ink transition-colors group-hover:text-accent">
                  {p.name}
                </h3>
                <p className="mt-1 text-xs text-ink-dim">{p.artistName}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <Link
          href={`/?project=${slug}`}
          className="inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-ink-dim"
        >
          ← explore connections
        </Link>
      </div>
    </div>
  );
}
