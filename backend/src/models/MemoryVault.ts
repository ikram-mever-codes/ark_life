import mongoose, { Document, Schema } from "mongoose";

export type MemoryVaultFileType =
  | "pdf"
  | "txt"
  | "md"
  | "docx"
  | "json"
  | "audio"
  | "mp3"
  | "wav";

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

const MemoryVaultFileSchema = new Schema(
  {
    fileName: { type: String, required: true },
    fileType: {
      type: String,
      enum: ["pdf", "txt", "md", "docx", "json", "audio", "mp3", "wav"],
      required: true,
    },
    s3Url: { type: String },
    localPath: { type: String },
    uploadDate: { type: Date, default: Date.now },
    isIndexed: { type: Boolean, default: false },
    /** Link to a specific Avatar */
    avatarId: {
      type: Schema.Types.ObjectId,
      ref: "Avatar",
      default: null,
      index: true, // Indexed for faster RAG retrieval during chat
    },
  },
  { _id: true },
);

const MemoryVaultSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // RAW ASSETS
    neuralBio: { type: String },
    files: [MemoryVaultFileSchema],
    // VECTOR METADATA (For RAG)
    vectorConfig: {
      indexName: { type: String, default: "vector_index" },
      isIndexed: { type: Boolean, default: false },
      lastIndexedAt: { type: Date },
    },
    // DATA SOVEREIGNTY (Privacy)
    encryption: {
      algorithm: { type: String, default: "AES-256-GCM" },
      isQuantumReady: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  },
);

const MemoryVault = mongoose.model<IMemoryVault>(
  "MemoryVault",
  MemoryVaultSchema,
);

export default MemoryVault;
