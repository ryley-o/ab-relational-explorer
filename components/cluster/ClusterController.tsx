"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import type { ClientGraph } from "@/lib/semantic-graph/types";
import type { ProjectMeta } from "@/lib/projects/types";
import { fetchClientGraph } from "@/lib/semantic-graph/fetch-client";
import { ClusterProjectsView } from "./ClusterProjectsView";
import { ExploreGraph } from "@/components/home/ExploreGraph";
import { useFilterState } from "@/lib/use-filter-state";

interface ClusterControllerProps {
  cluster: { id: string; label: string; description: string };
  members: Array<{ id: string; metadata: ProjectMeta }>;
  initialFocusId?: string | null;
}

export function ClusterController({ cluster, members, initialFocusId = null }: ClusterControllerProps) {
  const router = useRouter();
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(initialFocusId);
  const [fullGraph, setFullGraph] = useState<ClientGraph<ProjectMeta> | null>(null);
  const [filters, setFilters] = useFilterState();

  useEffect(() => {
    fetchClientGraph<ProjectMeta>().then(setFullGraph);
  }, []);

  async function handleFocusNode(nodeId: string) {
    const graph = fullGraph ?? await fetchClientGraph<ProjectMeta>();
    setFullGraph(graph);
    setFocusedNodeId(nodeId);
    router.push(`/cluster/${encodeURIComponent(cluster.id)}?project=${nodeId}`, { scroll: false });
  }

  function handleBack() {
    setFocusedNodeId(null);
    router.push(`/cluster/${encodeURIComponent(cluster.id)}`, { scroll: false });
  }

  return (
    <AnimatePresence mode="sync">
      {focusedNodeId === null || fullGraph === null ? (
        <ClusterProjectsView
          key="browse"
          cluster={cluster}
          members={members}
          onCardClick={handleFocusNode}
          filters={filters}
          onFiltersChange={setFilters}
        />
      ) : (
        <ExploreGraph
          key="explore"
          graph={fullGraph}
          focusedNodeId={focusedNodeId}
          onFocusNode={handleFocusNode}
          onBack={handleBack}
          backLabel="← Back to style"
          filters={filters}
        />
      )}
    </AnimatePresence>
  );
}
