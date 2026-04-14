"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_controller_1 = __importDefault(require("../controllers/chat.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/", auth_1.authenticate, chat_controller_1.default.interact);
router.get("/history/:avatarId", auth_1.authenticate, chat_controller_1.default.getHistory);
exports.default = router;
//# sourceMappingURL=chat.routes.js.map