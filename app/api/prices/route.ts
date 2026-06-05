import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { readFileSync } from "fs";
import { join } from "path";

const AB_GRAPHQL = "https://api.artblocks.io/graph";
const AB_API_KEY = process.env.AB_API_KEY ?? "";
const ETH_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";

interface ProjectRow { id: string; license: string | null; lowest_listing: number | null }

const MARKET_QUERY = `
query GetMarketData($limit: Int!, $offset: Int!) {
  projects_metadata(
    where: { tags: { tag_name: { _eq: "ab500" } } }
    order_by: { start_datetime: asc }
    limit: $limit
    offset: $offset
  ) { id license lowest_listing }
}
`;

async function fetchGql(limit: number, offset: number): Promise<ProjectRow[]> {
  const res = await fetch(AB_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AB_API_KEY}`,
    },
    body: JSON.stringify({ query: MARKET_QUERY, variables: { limit, offset } }),
  });
  if (!res.ok) throw new Error(`AB API ${res.status}`);
  const json = (await res.json()) as { data: { projects_metadata: ProjectRow[] } };
  return json.data?.projects_metadata ?? [];
}

async function fetchLiveProjects(): Promise<ProjectRow[]> {
  const [p1, p2, p3] = await Promise.all([
    fetchGql(200, 0),
    fetchGql(200, 200),
    fetchGql(200, 400),
  ]);
  return [...p1, ...p2, ...p3];
}

function readStaticCache(): ProjectRow[] {
  try {
    const raw = readFileSync(join(process.cwd(), "public", "market-data.json"), "utf-8");
    const json = JSON.parse(raw) as { projects: Record<string, { floorEth: number | null; license: string | null }> };
    return Object.entries(json.projects).map(([id, v]) => ({
      id,
      license: v.license,
      lowest_listing: v.floorEth,
    }));
  } catch {
    return [];
  }
}

// ── Server-side cache: revalidates every hour ───────────────────────────────

const getMarketData = unstable_cache(
  async () => {
    // Live ETH price (Next.js fetch cache handles 5-min revalidation)
    const ethUsd = await fetch(ETH_PRICE_URL, { next: { revalidate: 300 } })
      .then((r) => r.json() as Promise<{ ethereum: { usd: number } }>)
      .then((j) => j.ethereum?.usd ?? null)
      .catch(() => null);

    // Floor prices — prefer live AB API if key is set, else static cache
    let rows: ProjectRow[] = [];
    if (AB_API_KEY) {
      try {
        rows = await fetchLiveProjects();
      } catch (err) {
        console.error("[/api/prices] live fetch failed, falling back to static cache:", err);
        rows = readStaticCache();
      }
    } else {
      rows = readStaticCache();
    }

    const projects: Record<string, { floorEth: number | null; license: string | null }> = {};
    for (const row of rows) {
      projects[row.id] = { floorEth: row.lowest_listing ?? null, license: row.license ?? null };
    }

    return { ethUsd, projects };
  },
  ["ab-market-data"],
  { revalidate: 3600 }, // 1 hour
);

export async function GET() {
  const data = await getMarketData();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
