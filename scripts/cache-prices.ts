/**
 * Fetches floor prices + license data for all ab500 projects from Art Blocks API
 * and writes to public/market-data.json (used as static fallback by /api/prices).
 *
 * Usage:
 *   AB_API_KEY=your_key npm run cache-prices
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const AB_GRAPHQL = "https://api.artblocks.io/graph";
const AB_API_KEY = process.env.AB_API_KEY ?? "";

if (!AB_API_KEY) {
  console.error("AB_API_KEY is not set. Export it before running:\n  AB_API_KEY=xxx npm run cache-prices");
  process.exit(1);
}

const QUERY = `
query GetMarketData($limit: Int!, $offset: Int!) {
  projects_metadata(
    where: { tags: { tag_name: { _eq: "ab500" } } }
    order_by: { start_datetime: asc }
    limit: $limit
    offset: $offset
  ) {
    id
    license
    lowest_listing
  }
}
`;

interface Row { id: string; license: string | null; lowest_listing: number | null }

async function fetchBatch(limit: number, offset: number): Promise<Row[]> {
  const res = await fetch(AB_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AB_API_KEY}` },
    body: JSON.stringify({ query: QUERY, variables: { limit, offset } }),
  });
  if (!res.ok) throw new Error(`AB API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { projects_metadata: Row[] } };
  return json.data?.projects_metadata ?? [];
}

async function main() {
  console.log("Fetching market data from Art Blocks API…");

  const allRows: Row[] = [];
  let offset = 0;
  while (true) {
    const batch = await fetchBatch(200, offset);
    if (batch.length === 0) break;
    allRows.push(...batch);
    console.log(`  Fetched ${allRows.length} projects…`);
    offset += batch.length;
    if (batch.length < 200) break;
  }

  const projects: Record<string, { floorEth: number | null; license: string | null }> = {};
  for (const row of allRows) {
    projects[row.id] = { floorEth: row.lowest_listing ?? null, license: row.license ?? null };
  }

  const out = { cachedAt: new Date().toISOString(), ethUsd: null as number | null, projects };

  // Try to get ETH/USD price
  try {
    const priceRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    );
    const priceJson = (await priceRes.json()) as { ethereum: { usd: number } };
    out.ethUsd = priceJson.ethereum?.usd ?? null;
  } catch {
    console.warn("  Could not fetch ETH/USD price.");
  }

  const outPath = join(process.cwd(), "public", "market-data.json");
  mkdirSync(join(process.cwd(), "public"), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`\nWrote ${Object.keys(projects).length} projects to public/market-data.json`);
  if (out.ethUsd) console.log(`ETH/USD: $${out.ethUsd}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
