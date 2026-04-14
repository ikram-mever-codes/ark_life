import mongoose, { Document, Schema } from "mongoose";

export type AvatarStatus = "draft" | "training" | "ready";

export interface IAvatar extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  status: AvatarStatus;

  /** The specific front-facing photo used by SadTalker for animation */
  heroImageUrl: string | null;

  /** The pre-generated SadTalker lip-sync loop */
  masterVideoUrl: string | null;

  /** Gallery for 3D depth reference (The 20 photos) */
  photoUrls: string[];

  /** Voice samples for ElevenLabs cloning */
  voiceSampleUrls: string[];

  /** Connection to the User's central Memory Vault (Knowledge Base) */
  memoryVaultId: mongoose.Types.ObjectId;

  /** ElevenLabs voice_id; null until cloning is successful */
  voiceId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const AvatarSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["draft", "training", "ready"],
      default: "draft",
    },

    // SadTalker Paths
    heroImageUrl: { type: String, default: null },
    masterVideoUrl: { type: String, default: null },

    photoUrls: { type: [String], default: [] },
    voiceSampleUrls: { type: [String], default: [] },

    // Links this specific "Body/Voice" to a "Brain"
    memoryVaultId: {
      type: Schema.Types.ObjectId,
      ref: "MemoryVault",
      required: false,
    },

    voiceId: { type: String, default: null },
  },
  { timestamps: true },
);

const Avatar = mongoose.model<IAvatar>("Avatar", AvatarSchema);
export default Avatar;
