import { loadFullGraph, toClientGraph } from "@/lib/semantic-graph/load";
import { ClusterLanding } from "@/components/home/ClusterLanding";
import type { ProjectMeta } from "@/lib/projects/types";

export default async function HomePage() {
  let clientGraph;
  try {
    clientGraph = toClientGraph(loadFullGraph<ProjectMeta>());
  } catch {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-dim mb-4">
            graph not built
          </p>
          <p className="text-2xl text-ink mb-3">No graph yet</p>
          <p className="text-sm text-ink-dim leading-relaxed">
            Add your API keys to{" "}
            <code className="rounded bg-canvas-raised px-1.5 py-0.5 font-mono text-xs text-ink">
              .env
            </code>{" "}
            then run{" "}
            <code className="rounded bg-canvas-raised px-1.5 py-0.5 font-mono text-xs text-ink">
              npm run build-graph
            </code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <ClusterLanding graph={clientGraph} />
    </div>
  );
}
