import mongoose, { Document, Schema } from "mongoose";

export type AvatarStatus = "draft" | "training" | "ready";

export interface IAvatar extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  status: AvatarStatus;
  mouthCoords?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  heroImageUrl: string | null;

  masterVideoUrl: string | null;

  photoUrls: string[];

  voiceSampleUrls: string[];

  memoryVaultId: mongoose.Types.ObjectId;
  masterVideoError: string | null;
  didTalkCreatedAt: Date | null;
  voiceId: string | null;
  didTalkId: string | null;
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
    didTalkId: { type: String, default: null },
    masterVideoUrl: { type: String, default: null },
    masterVideoError: { type: String, default: null },
    didTalkCreatedAt: { type: Date, default: null },
    heroImageUrl: { type: String, default: null },
    mouthCoords: {
      type: {
        x: { type: Number },
        y: { type: Number },
        width: { type: Number },
        height: { type: Number },
      },
    },
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
