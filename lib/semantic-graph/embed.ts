/**
 * semantic-graph — Voyage AI embedding client (server-only)
 *
 * embedMultimodal: uses voyage-multimodal-3 (text + optional image → 1024-dim vector)
 * embedTexts: text-only fallback using voyage-3-large (kept for runtime query use)
 *
 * Images are fetched once and cached to .graph-cache/images.json so re-runs
 * don't re-download. Embedding results are cached by sha256(text + imageUrl).
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOYAGE_TEXT_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MULTIMODAL_URL = "https://api.voyageai.com/v1/multimodalembeddings";
const TEXT_MODEL = "voyage-3-large";
const MULTIMODAL_MODEL = "voyage-multimodal-3";
const TEXT_BATCH_SIZE = 8;
const MULTIMODAL_BATCH_SIZE = 1; // 1 item per request — respects 10K TPM free-tier limit

// ---------------------------------------------------------------------------
// Cache helpers — one file per item, sharded by first 2 hex chars
// ---------------------------------------------------------------------------

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Path for a single cached embedding vector. */
function embPath(cacheDir: string, key: string): string {
  const shard = key.slice(0, 2);
  return join(cacheDir, "emb", shard, `${key}.json`);
}

/** Path for a single cached image (base64 data URI). */
function imgPath(cacheDir: string, key: string): string {
  const shard = key.slice(0, 2);
  return join(cacheDir, "img", shard, `${key}.txt`);
}

function readEmbedding(cacheDir: string, key: string): number[] | null {
  const p = embPath(cacheDir, key);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")) as number[]; } catch { return null; }
}

function writeEmbedding(cacheDir: string, key: string, vec: number[]): void {
  const p = embPath(cacheDir, key);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(vec));
}

function readImage(cacheDir: string, key: string): string | null {
  const p = imgPath(cacheDir, key);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, "utf-8"); } catch { return null; }
}

function writeImage(cacheDir: string, key: string, dataUri: string): void {
  const p = imgPath(cacheDir, key);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, dataUri);
}

// ---------------------------------------------------------------------------
// Image fetching
// ---------------------------------------------------------------------------

const IMAGE_SIZE = 256;

async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn(`  Image fetch failed (${res.status}): ${url}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    // Resize to 256×256 PNG — reduces token usage and normalises format
    const resized = await sharp(buffer)
      .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${resized.toString("base64")}`;
  } catch (err) {
    console.warn(`  Image fetch error for ${url}: ${err}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Voyage API calls
// ---------------------------------------------------------------------------

async function fetchTextEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(VOYAGE_TEXT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: texts, model: TEXT_MODEL }),
  });
  if (!res.ok) throw new Error(`Voyage text API error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

async function fetchMultimodalEmbeddings(
  inputs: Array<{ text: string; imageBase64: string | null }>,
  apiKey: string,
  attempt = 0,
): Promise<number[][]> {
  const apiInputs = inputs.map(({ text, imageBase64 }) => {
    const content: Array<Record<string, string>> = [];
    if (imageBase64) content.push({ type: "image_base64", image_base64: imageBase64 });
    content.push({ type: "text", text });
    return { content };
  });

  const res = await fetch(VOYAGE_MULTIMODAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ inputs: apiInputs, model: MULTIMODAL_MODEL }),
  });

  if (res.status === 429 && attempt < 8) {
    const wait = 60_000; // wait a full minute to clear both RPM and TPM windows
    console.log(`  Rate limited — waiting ${wait / 1000}s (attempt ${attempt + 1}/8)…`);
    await new Promise((r) => setTimeout(r, wait));
    return fetchMultimodalEmbeddings(inputs, apiKey, attempt + 1);
  }

  if (!res.ok) throw new Error(`Voyage multimodal API error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// ---------------------------------------------------------------------------
// Public: multimodal embedding (text + optional image)
// ---------------------------------------------------------------------------

/**
 * Embed items using voyage-multimodal-3. When an imageUrl is provided, the image
 * is fetched (and cached) then combined with the text in a single embedding call.
 * Items without imageUrl fall back to text-only multimodal input.
 */
export async function embedMultimodal(
  items: Array<{ text: string; imageUrl?: string }>,
  apiKey: string,
  cacheDir: string,
): Promise<number[][]> {
  mkdirSync(cacheDir, { recursive: true });

  const results: number[][] = new Array(items.length);
  const missing: Array<{ idx: number; text: string; imageUrl?: string }> = [];

  // Cache key includes both text and imageUrl so changes to either re-embed
  const keys = items.map(({ text, imageUrl }) =>
    hash(text + "||img:" + (imageUrl ?? "")),
  );

  for (let i = 0; i < items.length; i++) {
    const hit = readEmbedding(cacheDir, keys[i]);
    if (hit) { results[i] = hit; } else { missing.push({ idx: i, ...items[i] }); }
  }

  if (missing.length === 0) {
    console.log(`  All ${items.length} embeddings loaded from cache.`);
    return results;
  }

  // Pre-fetch all missing images (with caching)
  const imageUrls = [...new Set(missing.map((m) => m.imageUrl).filter(Boolean) as string[])];
  if (imageUrls.length > 0) {
    const newUrlCount = imageUrls.filter((u) => !readImage(cacheDir, hash(u))).length;
    console.log(`  Fetching ${newUrlCount} new image(s)…`);
    for (const url of imageUrls) {
      const urlHash = hash(url);
      if (!readImage(cacheDir, urlHash)) {
        const b64 = await fetchImageBase64(url);
        if (b64) writeImage(cacheDir, urlHash, b64);
      }
    }
  }

  // Embed in batches
  console.log(`  Embedding ${missing.length} item(s) via Voyage multimodal…`);
  for (let b = 0; b < missing.length; b += MULTIMODAL_BATCH_SIZE) {
    const batch = missing.slice(b, b + MULTIMODAL_BATCH_SIZE);
    const batchInputs = batch.map(({ text, imageUrl }) => ({
      text,
      imageBase64: imageUrl ? (readImage(cacheDir, hash(imageUrl)) ?? null) : null,
    }));

    const embeddings = await fetchMultimodalEmbeddings(batchInputs, apiKey);

    for (let j = 0; j < batch.length; j++) {
      const { idx } = batch[j];
      results[idx] = embeddings[j];
      writeEmbedding(cacheDir, keys[idx], embeddings[j]);
    }

    if (b + MULTIMODAL_BATCH_SIZE < missing.length) {
      // 3 RPM free-tier limit → wait 21s between single-item requests
      await new Promise((r) => setTimeout(r, 21_000));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public: text-only embedding (used for runtime query similarity at inference)
// ---------------------------------------------------------------------------

export async function embedTexts(
  texts: string[],
  apiKey: string,
  cacheDir: string,
): Promise<number[][]> {
  mkdirSync(cacheDir, { recursive: true });
  const keys = texts.map(hash);
  const results: number[][] = new Array(texts.length);
  const missing: Array<{ idx: number; text: string }> = [];

  for (let i = 0; i < texts.length; i++) {
    const hit = readEmbedding(cacheDir, keys[i]);
    if (hit) { results[i] = hit; } else { missing.push({ idx: i, text: texts[i] }); }
  }

  if (missing.length > 0) {
    for (let b = 0; b < missing.length; b += TEXT_BATCH_SIZE) {
      const batch = missing.slice(b, b + TEXT_BATCH_SIZE);
      const embeddings = await fetchTextEmbeddings(batch.map((m) => m.text), apiKey);
      for (let j = 0; j < batch.length; j++) {
        results[batch[j].idx] = embeddings[j];
        writeEmbedding(cacheDir, keys[batch[j].idx], embeddings[j]);
      }
      if (b + TEXT_BATCH_SIZE < missing.length) await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
