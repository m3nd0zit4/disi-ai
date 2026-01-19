import { Index } from '@upstash/vector';

console.log("[Vector] Initializing Index...");
if (!process.env.UPSTASH_VECTOR_REST_URL) console.warn("[Vector] ⚠️ UPSTASH_VECTOR_REST_URL is missing");
if (!process.env.UPSTASH_VECTOR_REST_TOKEN) console.warn("[Vector] ⚠️ UPSTASH_VECTOR_REST_TOKEN is missing");

// Vector index for embeddings
export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});
console.log("[Vector] Index initialized");

// Store embedding
export async function storeEmbedding(
  id: string,
  embedding: number[],
  metadata: Record<string, unknown>
) {
  await vectorIndex.upsert({
    id,
    vector: embedding,
    metadata,
  });
}

// Search similar embeddings
export async function searchSimilar(
  queryEmbedding: number[],
  topK: number = 5,
  filter?: string
) {
  const results = await vectorIndex.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter,
  });
  
  return results;
}

// Delete embedding
export async function deleteEmbedding(id: string) {
  await vectorIndex.delete(id);
}
