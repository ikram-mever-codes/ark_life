"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
// Connection options to prevent buffering timeouts
const connectionOptions = {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 10s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    family: 4, // Use IPv4, skip trying IPv6
};
// Safe Guard Method to run before running any DB Operation
const connectDB = async () => {
    try {
        const state = mongoose_1.default.connection.readyState;
        if (state === mongoose_1.default.ConnectionStates.connected) {
            console.log("✅ Already connected to MongoDB");
            return true;
        }
        if (state === mongoose_1.default.ConnectionStates.disconnected) {
            try {
                console.log("🔄 Connecting to MongoDB...");
                await mongoose_1.default.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/arklife", connectionOptions);
                console.log("✅ MongoDB Connected Successfully");
                // Add connection event listeners
                mongoose_1.default.connection.on("error", (err) => {
                    console.error("❌ MongoDB connection error:", err);
                });
                mongoose_1.default.connection.on("disconnected", () => {
                    console.log("⚠️ MongoDB disconnected");
                });
                return true;
            }
            catch (error) {
                console.error("❌ MongoDB connection failed:", error);
                return false;
            }
        }
        if (state === mongoose_1.default.ConnectionStates.connecting) {
            console.log("⏳ MongoDB connection in progress...");
            let retries = 10;
            while (retries > 0) {
                await delay(1000);
                if (mongoose_1.default.connection.readyState === mongoose_1.default.ConnectionStates.connected) {
                    console.log("✅ MongoDB Connected after waiting");
                    return true;
                }
                retries--;
            }
            console.error("❌ MongoDB connection timeout after waiting");
            return false;
        }
        return false;
    }
    catch (error) {
        console.error("❌ Unexpected error in connectDB:", error);
        return false;
    }
};
// Initial connection when the app starts
connectDB().catch(console.error);
exports.default = connectDB;
//# sourceMappingURL=database.js.map