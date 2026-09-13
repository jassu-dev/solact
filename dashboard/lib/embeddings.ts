/**
 * Client-side embeddings using @xenova/transformers (ONNX, no server RAM).
 * Uses the same BAAI/bge-small-en-v1.5 model as the old Python pipeline.
 */
import { pipeline, env } from "@xenova/transformers";

// Use remote model files (cached in browser after first load)
env.allowLocalModels = false;

const MODEL = "Xenova/bge-small-en-v1.5";
const CHUNK_TOKENS = 400; // conservative token budget per chunk
const CHUNK_OVERLAP_TOKENS = 60;

let _pipe: any = null;

async function getPipeline() {
  if (!_pipe) {
    _pipe = await pipeline("feature-extraction", MODEL, { quantized: true });
  }
  return _pipe;
}

/** Rough word-based chunker that stays under the token budget */
function chunkText(text: string, chunkSize = CHUNK_TOKENS, overlap = CHUNK_OVERLAP_TOKENS): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length <= chunkSize) return [text.trim()];
  const chunks: string[] = [];
  const step = Math.max(1, chunkSize - overlap);
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + chunkSize);
    if (slice.length) chunks.push(slice.join(" "));
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

/** Normalize a float32 vector to unit length (cosine similarity needs this) */
function normalize(vec: Float32Array): number[] {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec).map((v) => v / norm);
}

export interface EmbeddedChunk {
  chunk_index: number;
  chunk_text: string;
  token_count: number;
  embedding: number[];
}

/**
 * Chunk + embed text entirely in the browser.
 * Returns one entry per chunk with its float32 embedding vector.
 */
export async function embedDocument(text: string): Promise<EmbeddedChunk[]> {
  const extractor = await getPipeline();
  const chunks = chunkText(text);
  const result: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const output = await extractor(chunks[i], { pooling: "mean", normalize: false });
    const vec = output.data as Float32Array;
    result.push({
      chunk_index: i,
      chunk_text: chunks[i],
      token_count: Math.ceil(chunks[i].length / 4), // rough estimate
      embedding: normalize(vec),
    });
  }
  return result;
}

/**
 * Embed a single short query string in the browser using @xenova/transformers ONNX.
 * Runs in ~10-20ms with zero server memory overhead.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const extractor = await getPipeline();
  const output = await extractor(query, { pooling: "mean", normalize: false });
  const vec = output.data as Float32Array;
  return normalize(vec);
}
