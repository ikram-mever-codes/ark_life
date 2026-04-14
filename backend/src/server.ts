import app from "./app";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 8000;

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
