"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const uploadToCloudinary = async (filePath, avatarId) => {
    try {
        const result = await cloudinary_1.v2.uploader.upload(filePath, {
            folder: `arklife/avatars/${avatarId}`,
            resource_type: "image",
        });
        return result.secure_url;
    }
    catch (error) {
        console.error("Cloudinary Upload Error:", error);
        throw error;
    }
};
exports.uploadToCloudinary = uploadToCloudinary;
exports.default = cloudinary_1.v2;
//# sourceMappingURL=cloudinary.js.map