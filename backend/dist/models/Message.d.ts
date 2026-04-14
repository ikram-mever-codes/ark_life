import mongoose, { Document } from "mongoose";
export interface IMessage extends Document {
    userId: mongoose.Types.ObjectId;
    avatarId: mongoose.Types.ObjectId;
    role: "user" | "avatar";
    text: string;
    createdAt: Date;
}
declare const _default: mongoose.Model<IMessage, {}, {}, {}, mongoose.Document<unknown, {}, IMessage> & IMessage & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default _default;
