import { loadFullGraph, toClientGraph } from "@/lib/semantic-graph/load";
import { HomeController } from "@/components/home/HomeController";
import type { ProjectMeta } from "@/lib/projects/types";

interface HomePageProps {
  searchParams: Promise<{ project?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { project } = await searchParams;

  let clientGraph;
  try {
    const fullGraph = loadFullGraph<ProjectMeta>();
    clientGraph = toClientGraph(fullGraph);
  } catch {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-6">
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

  const validProject =
    project && clientGraph.nodes.some((n) => n.id === project) ? project : null;

  return (
    <div className="min-h-[calc(100vh-80px)]">
      <HomeController graph={clientGraph} initialFocusId={validProject} />
    </div>
  );
}
