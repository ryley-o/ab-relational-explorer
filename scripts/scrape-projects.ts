/**
 * Scrape Art Blocks projects from the public GraphQL API.
 *
 * Usage:
 *   npm run scrape                  # fetch all curated projects
 *   npm run scrape -- --limit 50    # fetch first 50
 *
 * Writes: data/projects.json
 *
 * The Art Blocks Hasura GraphQL endpoint is public and requires no auth.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { ProjectMeta } from "../lib/projects/types";

// NOTE: The Art Blocks public GraphQL endpoint requires auth in production.
// For re-scraping, use the Art Blocks MCP tool (mcp__claude_ai_Art_Blocks__graphql_query)
// and run the combine script, or supply an API key via AB_API_KEY env var.
const AB_API_KEY = process.env.AB_API_KEY ?? "";
const AB_GRAPHQL = "https://api.artblocks.io/graph";

const PROJECTS_QUERY = `
query GetProjects($limit: Int!, $offset: Int!) {
  projects_metadata(
    where: {
      tags: { tag_name: { _eq: "ab500" } }
    }
    order_by: { start_datetime: asc }
    limit: $limit
    offset: $offset
  ) {
    id
    name
    artist_name
    description
    tags { tag_name }
    script_type_and_version
    vertical { category_name }
    invocations
    start_datetime
    website
    contract { address }
    project_id
  }
}
`;

async function fetchProjects(limit: number, offset: number): Promise<unknown[]> {
  const res = await fetch(AB_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(AB_API_KEY ? { Authorization: `Bearer ${AB_API_KEY}` } : {}) },
    body: JSON.stringify({ query: PROJECTS_QUERY, variables: { limit, offset } }),
  });
  if (!res.ok) throw new Error(`GraphQL error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { projects_metadata: unknown[] } };
  return json.data.projects_metadata;
}

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const maxProjects = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;

const BATCH = 50;

async function main() {
  const allProjects: ProjectMeta[] = [];
  let offset = 0;

  console.log("Scraping Art Blocks projects…");

  while (allProjects.length < maxProjects) {
    const batch = await fetchProjects(Math.min(BATCH, maxProjects - allProjects.length), offset);
    if (batch.length === 0) break;

    for (const raw of batch as Record<string, unknown>[]) {
      const contractAddress = (raw.contract as Record<string, string>)?.address ?? "";
      const projectIndex = String(raw.project_id ?? "");
      const slug = `${contractAddress}-${projectIndex}`;

      const tags = ((raw.tags as Array<{ tag_name: string }>) ?? []).map((t) => t.tag_name);
      const vertical = (raw.vertical as Record<string, string>)?.category_name ?? "unknown";

      allProjects.push({
        slug: String(raw.id ?? slug),
        name: String(raw.name ?? ""),
        artistName: String(raw.artist_name ?? "Unknown Artist"),
        description: String(raw.description ?? ""),
        tags,
        scriptType: String(raw.script_type_and_version ?? ""),
        vertical,
        invocations: Number(raw.invocations ?? 0),
        startDatetime: String(raw.start_datetime ?? ""),
        artBlocksUrl: `https://www.artblocks.io/collection/${raw.id}`,
        featuredTokenImageUrl: `https://media-proxy.artblocks.io/1/${contractAddress}/${projectIndex}000000.png`,
        website: raw.website ? String(raw.website) : undefined,
      });
    }

    console.log(`  Fetched ${allProjects.length} projects…`);
    offset += batch.length;
    if (batch.length < BATCH) break;
  }

  const outDir = join(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "projects.json"), JSON.stringify(allProjects, null, 2));

  console.log(`\nWrote ${allProjects.length} projects to data/projects.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });
