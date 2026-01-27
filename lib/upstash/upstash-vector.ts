import { Index } from '@upstash/vector';
import OpenAI from 'openai';

let _vectorIndex: Index | null = null;
let _openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!_openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }
    _openaiClient = new OpenAI({ apiKey });
  }
  return _openaiClient;
}

function getVectorIndex() {
  if (!_vectorIndex) {
    if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
      throw new Error("Missing Upstash Vector environment variables");
    }
    _vectorIndex = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });
    console.log("[Vector] Index initialized");
  }
  return _vectorIndex;
}

// Store embedding
export async function storeEmbedding(
  id: string,
  embedding: number[],
  metadata: Record<string, unknown>
) {
  await getVectorIndex().upsert({
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
  const results = await getVectorIndex().query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter,
  });
  
  return results;
}

// Delete embedding
export async function deleteEmbedding(id: string) {
  await getVectorIndex().delete(id);
}

// Generate embedding using OpenAI
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  // Truncate text if too long (OpenAI has 8191 token limit for text-embedding-3-small)
  const truncatedText = text.slice(0, 8000);

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: truncatedText,
  });

  return response.data[0].embedding;
}
