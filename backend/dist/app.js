"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load env
dotenv_1.default.config({
    path: node_path_1.default.resolve(__dirname, "../env/.env"),
});
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const database_1 = __importDefault(require("./config/database"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const memory_routes_1 = __importDefault(require("./routes/memory.routes"));
const avatar_routes_1 = __importDefault(require("./routes/avatar.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const app = (0, express_1.default)();
(0, database_1.default)();
// Middleware
// MODIFIED HELMET: Allow cross-origin images so the frontend can display them
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
}));
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// --- STATIC FOLDER ACCESS ---
// This serves everything in the 'backend/uploads' folder at the '/uploads' URL path
app.use("/uploads", express_1.default.static(node_path_1.default.join(__dirname, "../uploads")));
// Health check and Welcome routes...
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        service: "ArkLife Backend",
        version: "1.0.0",
        database: "Connected",
    });
});
app.use("/api/v1/auth", auth_routes_1.default);
app.use("/api/v1/memory", memory_routes_1.default);
app.use("/api/v1/avatars", avatar_routes_1.default);
app.use("/api/v1/chat", chat_routes_1.default);
app.use("*", (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
    });
});
app.use((err, req, res, next) => {
    console.error("Error:", err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map