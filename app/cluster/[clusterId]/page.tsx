import { loadFullGraph, toClientGraph } from "@/lib/semantic-graph/load";
import { ClusterController } from "@/components/cluster/ClusterController";
import type { ProjectMeta } from "@/lib/projects/types";
import { notFound } from "next/navigation";

interface ClusterPageProps {
  params: Promise<{ clusterId: string }>;
  searchParams: Promise<{ project?: string }>;
}

export async function generateStaticParams() {
  const graph = toClientGraph(loadFullGraph<ProjectMeta>());
  return graph.clusters.map((c) => ({ clusterId: encodeURIComponent(c.id) }));
}

export default async function ClusterPage({ params, searchParams }: ClusterPageProps) {
  const { clusterId } = await params;
  const { project } = await searchParams;

  const graph = toClientGraph(loadFullGraph<ProjectMeta>());
  const cluster = graph.clusters.find((c) => c.id === decodeURIComponent(clusterId));
  if (!cluster) notFound();

  // Pass only the lean data needed for the browse view — full graph is
  // lazy-fetched client-side when the user opens ExploreGraph.
  const members = cluster.memberIds
    .map((id) => graph.nodes.find((n) => n.id === id))
    .filter(Boolean)
    .map((n) => ({ id: n!.id, metadata: n!.metadata as ProjectMeta }));

  const validProject = project && graph.nodes.some((n) => n.id === project) ? project : null;

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <ClusterController
        cluster={{ id: cluster.id, label: cluster.label, description: cluster.description }}
        members={members}
        initialFocusId={validProject}
      />
    </div>
  );
}
