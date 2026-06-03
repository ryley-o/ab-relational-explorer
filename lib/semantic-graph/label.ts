/**
 * semantic-graph — LLM label generation via Anthropic Claude (server-only)
 *
 * Generates axis labels (for PCA components) and cluster labels.
 * Results are cached by content hash to avoid redundant API calls on re-builds.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { AxisLabel } from "./types";

const MODEL = "claude-sonnet-4-6";

type LabelCache = Record<string, unknown>;

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function loadCache(cacheDir: string): LabelCache {
  const path = join(cacheDir, "labels.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as LabelCache;
  } catch {
    return {};
  }
}

function saveCache(cacheDir: string, cache: LabelCache): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, "labels.json"), JSON.stringify(cache, null, 2));
}

async function callClaude(client: Anthropic, prompt: string): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return block.text.trim();
}

async function parseJson<T>(
  client: Anthropic,
  prompt: string,
  validate: (parsed: unknown) => parsed is T,
): Promise<T> {
  const raw = await callClaude(client, prompt);
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (validate(parsed)) return parsed;
  } catch {
    // fall through to retry
  }
  const retry = await callClaude(
    client,
    prompt + "\n\nIMPORTANT: Your previous response could not be parsed as JSON. Respond with ONLY valid JSON, no other text.",
  );
  const cleaned2 = retry.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  const parsed2 = JSON.parse(cleaned2);
  if (!validate(parsed2)) throw new Error("Invalid response shape from Claude after retry");
  return parsed2;
}

function isAxisLabel(v: unknown): v is AxisLabel {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).name === "string" &&
    typeof (v as Record<string, unknown>).negative === "string" &&
    typeof (v as Record<string, unknown>).positive === "string"
  );
}

function isClusterLabel(v: unknown): v is { label: string; description: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).label === "string" &&
    typeof (v as Record<string, unknown>).description === "string"
  );
}

type ItemDesc = { title: string; description: string };

export async function labelAxis(
  negativeItems: ItemDesc[],
  positiveItems: ItemDesc[],
  client: Anthropic,
  cache: LabelCache,
): Promise<AxisLabel> {
  const cacheKey = hashContent(JSON.stringify({ negativeItems, positiveItems }));
  if (cacheKey in cache) return cache[cacheKey] as AxisLabel;

  const negList = negativeItems.map((item) => `  - ${item.title}: ${item.description}`).join("\n");
  const posList = positiveItems.map((item) => `  - ${item.title}: ${item.description}`).join("\n");

  const prompt = `You're labeling one axis of a 2D semantic projection of generative art projects.

Projects at the NEGATIVE end of this axis:
${negList}

Projects at the POSITIVE end of this axis:
${posList}

Respond with JSON only — no prose, no code fences:
{ "name": "<1-2 word axis name>", "negative": "<1-2 word pole>", "positive": "<1-2 word pole>" }`;

  const result = await parseJson(client, prompt, isAxisLabel);
  cache[cacheKey] = result;
  return result;
}

export async function labelCluster(
  members: ItemDesc[],
  client: Anthropic,
  cache: LabelCache,
): Promise<{ label: string; description: string }> {
  const cacheKey = hashContent(JSON.stringify(members));
  if (cacheKey in cache) return cache[cacheKey] as { label: string; description: string };

  const memberList = members.map((item) => `  - ${item.title}: ${item.description}`).join("\n");

  const prompt = `You're labeling a cluster of semantically related generative art projects.

Projects in this cluster:
${memberList}

Respond with JSON only — no prose, no code fences:
{ "label": "<2-4 word cluster name>", "description": "<one sentence describing what unifies these projects>" }`;

  const result = await parseJson(client, prompt, isClusterLabel);
  cache[cacheKey] = result;
  return result;
}

export function createLabelClient(
  apiKey: string,
  cacheDir: string,
): { client: Anthropic; cache: LabelCache; flush: () => void } {
  const client = new Anthropic({ apiKey });
  const cache = loadCache(cacheDir);
  return { client, cache, flush: () => saveCache(cacheDir, cache) };
}
