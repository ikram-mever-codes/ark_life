import multer from "multer";
declare const UPLOAD_BASE: string;
declare const ALLOWED_MIMES: Record<string, string>;
declare const ALLOWED_EXT: Set<string>;
export declare function getMemoryUploadDir(userId: string): string;
export declare const memoryUpload: multer.Multer;
export { UPLOAD_BASE, ALLOWED_EXT, ALLOWED_MIMES };
