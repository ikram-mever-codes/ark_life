// services/embeddingService.ts – OpenAI Embeddings API; store/query vectors tagged by userId
import OpenAI from "openai";
import MemoryChunk from "../models/MemoryChunk";
import mongoose from "mongoose";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // token limit
  });
  const vec = res?.data?.[0]?.embedding;
  if (!vec || !Array.isArray(vec))
    throw new Error("Invalid embedding response");
  return vec;
}

const GLOBAL_SCOPE = "GLOBAL";

export async function storeChunks(
  userId: mongoose.Types.ObjectId,
  memoryVaultId: mongoose.Types.ObjectId,
  source: "neuralBio" | "file",
  chunks: string[],
  fileId?: mongoose.Types.ObjectId,
  avatarId?: string,
) {
  for (const text of chunks) {
    if (!text.trim()) continue;
    const embedding = await getEmbedding(text);

    await MemoryChunk.create({
      userId, // Keep this as ObjectId
      memoryVaultId,
      // FIX: Ensure avatarId is ALWAYS a string in the DB
      avatarId: avatarId ? avatarId.toString() : GLOBAL_SCOPE,
      source,
      fileId,
      text,
      embedding,
    });
  }
}

export async function findTopChunks(
  userId: string,
  query: string,
  avatarId?: string,
  topK = 3,
) {
  const queryEmbedding = await getEmbedding(query);

  // We only include the avatarId in the search if we have one or want global
  const scopeArray: string[] = [GLOBAL_SCOPE];
  if (avatarId) scopeArray.push(avatarId.toString());

  const pipeline: any[] = [
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: topK,
        filter: {
          $and: [
            { userId: { $eq: new mongoose.Types.ObjectId(userId) } },
            {
              // FIX: Now both elements in the array are Strings. MongoDB is happy.
              avatarId: { $in: scopeArray },
            },
          ],
        },
      },
    },
    {
      $project: {
        text: 1,
        source: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  return await MemoryChunk.aggregate(pipeline);
}
