import path from "node:path";
import dotenv from "dotenv";

// Load env
dotenv.config({
  path: path.resolve(__dirname, "../env/.env"),
});

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import connectDB from "./config/database";
import authRoutes from "./routes/auth.routes";
import memoryRoutes from "./routes/memory.routes";
import avatarRoutes from "./routes/avatar.routes";
import chatRoutes from "./routes/chat.routes";
const app = express();

connectDB();

// Middleware
// MODIFIED HELMET: Allow cross-origin images so the frontend can display them
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  }),
);

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- STATIC FOLDER ACCESS ---
// This serves everything in the 'backend/uploads' folder at the '/uploads' URL path
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check and Welcome routes...
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "ArkLife Backend",
    version: "1.0.0",
    database: "Connected",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/memory", memoryRoutes);
app.use("/api/v1/avatars", avatarRoutes);
app.use("/api/v1/chat", chatRoutes);

app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

export default app;
