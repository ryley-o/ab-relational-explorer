import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { loadFullGraph, toClientGraph } from "@/lib/semantic-graph/load";
import { RelatedProjects } from "@/components/project/RelatedProjects";
import type { ProjectMeta } from "@/lib/projects/types";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;

  let clientGraph;
  try {
    const fullGraph = loadFullGraph<ProjectMeta>();
    clientGraph = toClientGraph(fullGraph);
  } catch {
    notFound();
  }

  const node = clientGraph.nodes.find((n) => n.id === slug);
  if (!node) notFound();

  const p = node.metadata;
  const cluster = clientGraph.clusters.find((c) => c.id === node.primaryClusterId);
  const year = new Date(p.startDatetime).getFullYear();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {/* Back link */}
      <Link
        href={`/?project=${slug}`}
        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-ink mb-12"
      >
        ← explore connections
      </Link>

      {/* Header */}
      <div className="mb-10">
        {cluster && (
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-3">
            {cluster.label}
          </p>
        )}
        <h1 className="text-4xl font-bold tracking-tight text-ink leading-tight mb-2">
          {p.name}
        </h1>
        <p className="text-lg text-ink-dim">{p.artistName} · {year}</p>
      </div>

      {/* Featured image */}
      <div className="relative mb-10 overflow-hidden rounded-xl bg-canvas-raised aspect-square max-w-sm">
        <Image
          src={p.featuredTokenImageUrl}
          alt={`${p.name} featured token`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 384px"
          unoptimized
        />
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        <span className="rounded-full border border-ink-faint/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
          {p.vertical}
        </span>
        <span className="rounded-full border border-ink-faint/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
          {p.scriptType}
        </span>
        <span className="rounded-full border border-ink-faint/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
          {p.invocations.toLocaleString()} editions
        </span>
        {p.tags
          .filter((t) => !t.startsWith("curated series") && t !== "ab500")
          .map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-accent/25 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent/80"
            >
              {tag}
            </span>
          ))}
      </div>

      {/* Description */}
      <p className="text-base leading-relaxed text-ink-dim mb-10">{p.description}</p>

      {/* Links */}
      <div className="flex flex-wrap gap-3 mb-16">
        <a
          href={p.artBlocksUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-lg border border-accent/35 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-accent transition-colors hover:border-accent hover:bg-accent/8"
        >
          View on Art Blocks →
        </a>
        {p.website && (
          <a
            href={p.website}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg border border-ink-faint/30 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-dim transition-colors hover:border-ink-dim hover:text-ink"
          >
            Artist website →
          </a>
        )}
      </div>

      {/* Related projects */}
      <div className="border-t border-ink-faint/15 pt-12">
        <RelatedProjects slug={slug} graph={clientGraph} />
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  try {
    const fullGraph = loadFullGraph<ProjectMeta>();
    return fullGraph.nodes.map((n) => ({ slug: n.id }));
  } catch {
    return [];
  }
}
