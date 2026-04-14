import mongoose, { Document } from "mongoose";
export interface IMemoryChunk extends Document {
    userId: mongoose.Types.ObjectId;
    memoryVaultId: mongoose.Types.ObjectId;
    /** * avatarId is stored as a String to allow the "GLOBAL" tag
     * and specific Avatar IDs to exist in the same vector search filter.
     */
    avatarId: string;
    source: "neuralBio" | "file";
    fileId?: mongoose.Types.ObjectId;
    text: string;
    embedding: number[];
    createdAt: Date;
    updatedAt: Date;
}
declare const MemoryChunk: mongoose.Model<IMemoryChunk, {}, {}, {}, mongoose.Document<unknown, {}, IMemoryChunk> & IMemoryChunk & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default MemoryChunk;
