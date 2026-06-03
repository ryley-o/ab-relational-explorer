"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import type { ClientGraph } from "@/lib/semantic-graph/types";
import type { ProjectMeta } from "@/lib/projects/types";
import { BrowseView } from "./BrowseView";
import { ExploreGraph } from "./ExploreGraph";

interface HomeControllerProps {
  graph: ClientGraph<ProjectMeta>;
  initialFocusId?: string | null;
}

export function HomeController({ graph, initialFocusId = null }: HomeControllerProps) {
  const router = useRouter();
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(initialFocusId);

  useEffect(() => {
    setFocusedNodeId(initialFocusId ?? null);
  }, [initialFocusId]);

  function handleFocusNode(nodeId: string) {
    setFocusedNodeId(nodeId);
    router.push(`/?project=${nodeId}`, { scroll: false });
  }

  function handleBack() {
    setFocusedNodeId(null);
    router.push("/", { scroll: false });
  }

  return (
    <LayoutGroup>
      <AnimatePresence mode="sync">
        {focusedNodeId === null ? (
          <BrowseView key="browse" graph={graph} onCardClick={handleFocusNode} />
        ) : (
          <ExploreGraph
            key="explore"
            graph={graph}
            focusedNodeId={focusedNodeId}
            onFocusNode={handleFocusNode}
            onBack={handleBack}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
