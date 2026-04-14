"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmbedding = getEmbedding;
exports.storeChunks = storeChunks;
exports.findTopChunks = findTopChunks;
// services/embeddingService.ts – OpenAI Embeddings API; store/query vectors tagged by userId
const openai_1 = __importDefault(require("openai"));
const MemoryChunk_1 = __importDefault(require("../models/MemoryChunk"));
const mongoose_1 = __importDefault(require("mongoose"));
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY || "",
});
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;
async function getEmbedding(text) {
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
async function storeChunks(userId, memoryVaultId, source, chunks, fileId, avatarId) {
    for (const text of chunks) {
        if (!text.trim())
            continue;
        const embedding = await getEmbedding(text);
        await MemoryChunk_1.default.create({
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
async function findTopChunks(userId, query, avatarId, topK = 3) {
    const queryEmbedding = await getEmbedding(query);
    // We only include the avatarId in the search if we have one or want global
    const scopeArray = [GLOBAL_SCOPE];
    if (avatarId)
        scopeArray.push(avatarId.toString());
    const pipeline = [
        {
            $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: 100,
                limit: topK,
                filter: {
                    $and: [
                        { userId: { $eq: new mongoose_1.default.Types.ObjectId(userId) } },
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
    return await MemoryChunk_1.default.aggregate(pipeline);
}
//# sourceMappingURL=embeddingService.js.map