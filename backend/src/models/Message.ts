import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  userId: mongoose.Types.ObjectId;
  avatarId: mongoose.Types.ObjectId;
  role: "user" | "avatar";
  text: string;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  avatarId: { type: Schema.Types.ObjectId, ref: "Avatar", required: true },
  role: { type: String, enum: ["user", "avatar"], required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

MessageSchema.index({ userId: 1, avatarId: 1, createdAt: 1 });

export default mongoose.model<IMessage>("Message", MessageSchema);
