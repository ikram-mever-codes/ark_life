import mongoose, { Document, Schema } from "mongoose";

export interface IMemoryChunk extends Document {
  userId: mongoose.Types.ObjectId;
  memoryVaultId: mongoose.Types.ObjectId;
  /** * avatarId is stored as a String to allow the "GLOBAL" tag
   * and specific Avatar IDs to exist in the same vector search filter.
   */
  avatarId: string;
  source: "neuralBio" | "file";
  fileId?: mongoose.Types.ObjectId;
  chunkIndex?: number;
  text: string;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const MemoryChunkSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    memoryVaultId: {
      type: Schema.Types.ObjectId,
      ref: "MemoryVault",
      required: true,
      index: true,
    },
    /** * Scoping field: Use "GLOBAL" for general user memories
     * or the Avatar's ID string for specific twin memories.
     */
    avatarId: {
      type: String,
      default: "GLOBAL",
      index: true,
    },
    source: {
      type: String,
      enum: ["neuralBio", "file"],
      required: true,
    },
    fileId: { type: Schema.Types.ObjectId, index: true },
    /** Position of the chunk inside its source document (for re-assembly). */
    chunkIndex: { type: Number, default: 0 },
    text: { type: String, required: true },
    embedding: {
      type: [Number],
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);

MemoryChunkSchema.index({ userId: 1, avatarId: 1 });

const MemoryChunk = mongoose.model<IMemoryChunk>(
  "MemoryChunk",
  MemoryChunkSchema,
);

export default MemoryChunk;
