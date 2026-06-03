"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import type { ClientGraph } from "@/lib/semantic-graph/types";
import type { ProjectMeta } from "@/lib/projects/types";
import { ClusterProjectsView } from "./ClusterProjectsView";
import { ExploreGraph } from "@/components/home/ExploreGraph";

interface ClusterControllerProps {
  graph: ClientGraph<ProjectMeta>;
  clusterId: string;
  initialFocusId?: string | null;
}

export function ClusterController({ graph, clusterId, initialFocusId = null }: ClusterControllerProps) {
  const router = useRouter();
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(initialFocusId);

  useEffect(() => {
    setFocusedNodeId(initialFocusId ?? null);
  }, [initialFocusId]);

  function handleFocusNode(nodeId: string) {
    setFocusedNodeId(nodeId);
    router.push(`/cluster/${encodeURIComponent(clusterId)}?project=${nodeId}`, { scroll: false });
  }

  function handleBack() {
    setFocusedNodeId(null);
    router.push(`/cluster/${encodeURIComponent(clusterId)}`, { scroll: false });
  }

  const cluster = graph.clusters.find((c) => c.id === clusterId)!;

  return (
    <AnimatePresence mode="sync">
      {focusedNodeId === null ? (
        <ClusterProjectsView
          key="browse"
          graph={graph}
          cluster={cluster}
          onCardClick={handleFocusNode}
        />
      ) : (
        <ExploreGraph
          key="explore"
          graph={graph}
          focusedNodeId={focusedNodeId}
          onFocusNode={handleFocusNode}
          onBack={handleBack}
          backLabel="← Back to collection"
        />
      )}
    </AnimatePresence>
  );
}
