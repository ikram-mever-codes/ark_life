import mongoose, { Document, Schema } from "mongoose";

export type MemoryVaultFileType =
  | "pdf"
  | "txt"
  | "md"
  | "docx"
  | "json"
  | "audio"
  | "mp3"
  | "wav"
  | "jpg"
  | "png";

/** Processing lifecycle of an uploaded document. */
export type DocumentStatus =
  | "processing"
  | "ocr_processing"
  | "indexed"
  | "failed";

/** Which product area the document belongs to (see M3 spec section 8). */
export type DocumentCategory = "clinical" | "personal";

/** Where the document came from. "fse" = imported from the Fascicolo Sanitario Elettronico. */
export type DocumentSource = "upload" | "fse";

export interface IMemoryVaultFile {
  _id?: mongoose.Types.ObjectId;
  fileName: string;
  fileType: MemoryVaultFileType;
  s3Url?: string;
  localPath?: string;
  uploadDate: Date;
  isIndexed?: boolean;
  status?: DocumentStatus;
  indexError?: string | null;
  ocrUsed?: boolean;
  pageCount?: number;
  chunkCount?: number;
  sizeBytes?: number;
  mimeType?: string;
  category?: DocumentCategory;
  source?: DocumentSource;
  processingStartedAt?: Date | null;
  processedAt?: Date | null;
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
      enum: [
        "pdf",
        "txt",
        "md",
        "docx",
        "json",
        "audio",
        "mp3",
        "wav",
        "jpg",
        "png",
      ],
      required: true,
    },
    s3Url: { type: String },
    localPath: { type: String },
    uploadDate: { type: Date, default: Date.now },
    isIndexed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["processing", "ocr_processing", "indexed", "failed"],
    },
    indexError: { type: String, default: null },
    ocrUsed: { type: Boolean, default: false },
    pageCount: { type: Number },
    chunkCount: { type: Number },
    sizeBytes: { type: Number },
    mimeType: { type: String },
    category: {
      type: String,
      enum: ["clinical", "personal"],
      default: "personal",
    },
    source: { type: String, enum: ["upload", "fse"], default: "upload" },
    processingStartedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
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
