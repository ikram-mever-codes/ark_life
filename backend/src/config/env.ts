// config/env.ts — load environment variables BEFORE any other module reads them.
// Must be the first import in server.ts. Modules such as utils/jwt.ts and
// chat.controller.ts read process.env at import time.
import path from "node:path";
import dotenv from "dotenv";

// backend/.env (preferred), then backend/env/.env (legacy server layout).
// dotenv never overrides variables that are already set, so real
// environment variables (PM2 / Docker) always win.
for (const candidate of [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../env/.env"),
]) {
  dotenv.config({ path: candidate });
}

const REQUIRED_IN_PRODUCTION = ["MONGODB_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];

if (process.env.NODE_ENV === "production") {
  const missing = REQUIRED_IN_PRODUCTION.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. See backend/.env.example`,
    );
  }
}

export {};
