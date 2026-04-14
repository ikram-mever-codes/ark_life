"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PORT = process.env.PORT || 8000;
const server = app_1.default.listen(PORT, () => {
    console.log(`
  🚀 ArkLife Backend Server Started!
  📡 Port: ${PORT}
  🔗 Health: http://localhost:${PORT}/api/health
  🌐 Frontend: ${process.env.FRONTEND_URL || "http://localhost:3000"}
  📅 Time: ${new Date().toLocaleString()}
  `);
});
// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
process.on("SIGINT", () => {
    console.log("SIGINT received. Shutting down gracefully...");
    server.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map