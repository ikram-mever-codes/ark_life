import "./pre-start";
import app from "./app";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 8000;

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise) => {
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("⚠️  UNHANDLED PROMISE REJECTION — server stays alive");
  console.error("Reason:", reason?.message || reason);
  console.error("Stack:", reason?.stack || "(no stack)");
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

// Catch uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("⚠️  UNCAUGHT EXCEPTION — server stays alive");
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

// Heap pressure warning — logs when memory usage gets concerning.
// If you see this firing, it means the real fix (streaming pipeline) is
// overdue. For now it just tells you before the crash happens.
setInterval(() => {
  const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024;
  const heapTotalMB = process.memoryUsage().heapTotal / 1024 / 1024;
  if (heapUsedMB > 2000) {
    console.warn(
      `⚠️  [Memory] Heap usage is ${heapUsedMB.toFixed(0)}MB / ${heapTotalMB.toFixed(0)}MB — indexer may be leaking`,
    );
  }
}, 30_000); // check every 30s

const server = app.listen(PORT, () => {
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
