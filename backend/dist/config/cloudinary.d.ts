import { v2 as cloudinary } from "cloudinary";
export declare const uploadToCloudinary: (filePath: string, avatarId: string) => Promise<string>;
export default cloudinary;
