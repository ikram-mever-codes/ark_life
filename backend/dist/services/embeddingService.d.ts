import mongoose from "mongoose";
export declare function getEmbedding(text: string): Promise<number[]>;
export declare function storeChunks(userId: mongoose.Types.ObjectId, memoryVaultId: mongoose.Types.ObjectId, source: "neuralBio" | "file", chunks: string[], fileId?: mongoose.Types.ObjectId, avatarId?: string): Promise<void>;
export declare function findTopChunks(userId: string, query: string, avatarId?: string, topK?: number): Promise<any[]>;
