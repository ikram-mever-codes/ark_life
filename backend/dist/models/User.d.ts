import mongoose, { Document } from "mongoose";
export interface IUser extends Document {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    subscriptionTier: "free" | "pro" | "business";
    credits: number;
    isEmailVerified: boolean;
    isOnboarded: boolean;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    otpCode?: string;
    otpExpires?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    lastLogin?: Date;
    useage: {
        avatarCount: number;
        monthlyMessageCount: number;
        lastUsageReset: Date;
    };
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    generateEmailVerificationToken(): string;
    generateOTP(): string;
    setPasswordResetToken(): string;
}
declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser> & IUser & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default User;
