import mongoose, { Document } from "mongoose";
export type MemoryVaultFileType = "pdf" | "txt" | "md" | "docx" | "json" | "audio" | "mp3" | "wav";
export interface IMemoryVaultFile {
    _id?: mongoose.Types.ObjectId;
    fileName: string;
    fileType: MemoryVaultFileType;
    s3Url?: string;
    localPath?: string;
    uploadDate: Date;
    isIndexed?: boolean;
    /** * Scope: If null, memory is global for the user.
     * If set, memory belongs to a specific digital twin.
     */
    avatarId: mongoose.Types.ObjectId | null;
}
export interface IMemoryVaultVectorConfig {
    indexName: string;
    isIndexed: boolean;
    lastIndexedAt?: Date;
}
export interface IMemoryVaultEncryption {
    algorithm: string;
    isQuantumReady: boolean;
}
export interface IMemoryVault extends Document {
    userId: mongoose.Types.ObjectId;
    neuralBio?: string;
    files: IMemoryVaultFile[];
    vectorConfig: IMemoryVaultVectorConfig;
    encryption: IMemoryVaultEncryption;
    createdAt: Date;
    updatedAt: Date;
}
declare const MemoryVault: mongoose.Model<IMemoryVault, {}, {}, {}, mongoose.Document<unknown, {}, IMemoryVault> & IMemoryVault & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default MemoryVault;
