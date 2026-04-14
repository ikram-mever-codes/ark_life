import mongoose from "mongoose";
/** Index a single file: extract text -> chunk -> embed -> store; update file and vault isIndexed */
export declare function indexFile(vaultId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, fileId: mongoose.Types.ObjectId, localPath: string, fileType: string, avatarId?: string): Promise<{
    ok: true;
} | {
    ok: false;
    error: string;
}>;
/** Index neural bio: chunk -> embed -> store; set vault.vectorConfig.isIndexed */
export declare function indexNeuralBio(vaultId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, neuralBio: string, avatarId?: string): Promise<{
    ok: true;
} | {
    ok: false;
    error: string;
}>;
/** Remove all chunks for a vault (e.g. before re-indexing). */
export declare function clearVaultChunks(vaultId: mongoose.Types.ObjectId): Promise<void>;
