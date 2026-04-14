"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const MemoryVaultFileSchema = new mongoose_1.Schema({
    fileName: { type: String, required: true },
    fileType: {
        type: String,
        enum: ["pdf", "txt", "md", "docx", "json", "audio", "mp3", "wav"],
        required: true,
    },
    s3Url: { type: String },
    localPath: { type: String },
    uploadDate: { type: Date, default: Date.now },
    isIndexed: { type: Boolean, default: false },
    /** Link to a specific Avatar */
    avatarId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Avatar",
        default: null,
        index: true, // Indexed for faster RAG retrieval during chat
    },
}, { _id: true });
const MemoryVaultSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    // RAW ASSETS
    neuralBio: { type: String },
    files: [MemoryVaultFileSchema],
    // VECTOR METADATA (For RAG)
    vectorConfig: {
        indexName: { type: String, default: "vector_index" },
        isIndexed: { type: Boolean, default: false },
        lastIndexedAt: { type: Date },
    },
    // DATA SOVEREIGNTY (Privacy)
    encryption: {
        algorithm: { type: String, default: "AES-256-GCM" },
        isQuantumReady: { type: Boolean, default: false },
    },
}, {
    timestamps: true,
});
const MemoryVault = mongoose_1.default.model("MemoryVault", MemoryVaultSchema);
exports.default = MemoryVault;
//# sourceMappingURL=MemoryVault.js.map