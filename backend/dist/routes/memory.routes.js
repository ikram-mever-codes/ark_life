"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/memory.routes.ts
const express_1 = require("express");
const memory_controller_1 = __importDefault(require("../controllers/memory.controller"));
const auth_1 = require("../middleware/auth");
const multer_1 = require("../config/multer");
const router = (0, express_1.Router)();
// All memory routes require auth (userId-scoped to prevent data leakage)
router.post("/add-memory", auth_1.authenticate, multer_1.memoryUpload.single("file"), memory_controller_1.default.addMemory);
router.get("/rag-query", auth_1.authenticate, memory_controller_1.default.ragQuery);
router.get("/vault", auth_1.authenticate, memory_controller_1.default.getVault);
router.delete("/files/:fileId", auth_1.authenticate, memory_controller_1.default.deleteMemory);
exports.default = router;
//# sourceMappingURL=memory.routes.js.map