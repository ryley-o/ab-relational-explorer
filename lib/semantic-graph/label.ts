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

async function callClaude(client: Anthropic, prompt: string, maxTokens = 200): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
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
  maxTokens = 200,
): Promise<T> {
  const raw = await callClaude(client, prompt, maxTokens);
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
    maxTokens,
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

export type DisambiguationAction =
  | { action: "rename"; id: string; label: string; description: string }
  | { action: "merge"; keepId: string; dropId: string; label: string; description: string };

function isDisambiguationResult(v: unknown): v is { actions: DisambiguationAction[] } {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  if (!Array.isArray(obj.actions)) return false;
  return (obj.actions as unknown[]).every((a) => {
    if (typeof a !== "object" || a === null) return false;
    const act = a as Record<string, unknown>;
    if (act.action === "rename") {
      return typeof act.id === "string" && typeof act.label === "string" && typeof act.description === "string";
    }
    if (act.action === "merge") {
      return (
        typeof act.keepId === "string" &&
        typeof act.dropId === "string" &&
        typeof act.label === "string" &&
        typeof act.description === "string"
      );
    }
    return false;
  });
}

export async function disambiguateClusters(
  clusters: Array<{ id: string; label: string; description: string }>,
  client: Anthropic,
  cache: LabelCache,
): Promise<DisambiguationAction[]> {
  const cacheKey = `disambiguate:${hashContent(JSON.stringify(clusters))}`;
  if (cacheKey in cache) return cache[cacheKey] as DisambiguationAction[];

  const clusterList = clusters
    .map((c) => `  ${c.id}: "${c.label}" — ${c.description}`)
    .join("\n");

  const prompt = `You are reviewing cluster labels for a semantic map of Art Blocks generative art projects. Find any pairs of clusters whose labels and themes are too similar to be meaningfully distinct, then either rename them to be more specific or merge them.

Clusters:
${clusterList}

Rules:
- Only flag pairs where there is genuine confusion: nearly identical names, or descriptions covering the same visual/thematic territory.
- "rename": use when the clusters ARE genuinely different underneath but have lazy or overlapping names. Rename each to something more specific and visually distinctive.
- "merge": use when no meaningful visual or thematic distinction can be drawn even with better names. Set keepId to the larger/more representative cluster.
- Leave clearly distinct clusters alone — do not rename for the sake of it.
- Labels must be 2–5 words, specific to the visual aesthetic — not generic phrases like "Generative Abstract Art" or "Abstract Generative Compositions".
- If nothing needs changing, return an empty actions array.

Respond with JSON only — no prose, no code fences:
{ "actions": [] }

Each action is one of:
{ "action": "rename", "id": "<id>", "label": "<new label>", "description": "<new one-sentence description>" }
{ "action": "merge", "keepId": "<id to keep>", "dropId": "<id to remove>", "label": "<merged label>", "description": "<merged one-sentence description>" }`;

  const result = await parseJson(client, prompt, isDisambiguationResult, 1500);
  cache[cacheKey] = result.actions;
  return result.actions;
}

export function createLabelClient(
  apiKey: string,
  cacheDir: string,
): { client: Anthropic; cache: LabelCache; flush: () => void } {
  const client = new Anthropic({ apiKey });
  const cache = loadCache(cacheDir);
  return { client, cache, flush: () => saveCache(cacheDir, cache) };
}
