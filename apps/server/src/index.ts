import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerAdmin } from "./admin.js";
import { config } from "./config.js";
import { initActivityLog } from "./activityLog.js";
import { initRoundEngine, startBackgroundTimers } from "./roundLoop.js";
import { registerRoutes } from "./routes.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});
await registerRoutes(app);
await registerAdmin(app);

await initActivityLog();
await initRoundEngine();
startBackgroundTimers();

await app.listen({ port: config.port, host: "0.0.0.0" });
