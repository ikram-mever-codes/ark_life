import mongoose, { Document } from "mongoose";
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
declare const Avatar: mongoose.Model<IAvatar, {}, {}, {}, mongoose.Document<unknown, {}, IAvatar> & IAvatar & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default Avatar;
