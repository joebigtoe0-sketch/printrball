import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";
import { readExclusionsFile, saveExclusions, isPlausibleSolanaAddress } from "./exclusions.js";
import { getEffectiveTokenMint, loadRuntime, type RuntimeConfig, saveRuntime } from "./runtimeStore.js";
import { estimatePrizeLamports, getLivePrizeStatus } from "./prizeEngine.js";
import {
  nextFullRoundBoundaryMs,
  refreshHolders,
  startRoundSystemFromAdmin,
  saveTokenMintAndReload,
} from "./roundLoop.js";
import { appState, history } from "./state.js";

const sessions = new Map<string, number>();
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a, "utf-8");
  const B = Buffer.from(b, "utf-8");
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

function extractBearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

function requireSession(req: FastifyRequest, reply: FastifyReply): boolean {
  const t = extractBearer(req);
  if (!t) {
    void reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  const created = sessions.get(t);
  if (!created || Date.now() - created > SESSION_MS) {
    sessions.delete(t);
    void reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

export async function registerAdmin(app: FastifyInstance) {
  app.post("/api/admin/login", async (req, reply) => {
    if (!config.adminPassword) {
      return reply.code(503).send({ error: "SERVER_CONFIG", message: "Set ADMIN_PASSWORD in the server environment" });
    }
    const body = (req.body ?? {}) as { password?: string };
    const p = body.password ?? "";
    if (!safeEqual(p, config.adminPassword)) {
      return reply.code(401).send({ error: "invalid_password" });
    }
    const t = randomBytes(32).toString("hex");
    sessions.set(t, Date.now());
    return { token: t, expiresInMs: SESSION_MS };
  });

  app.get("/api/admin/status", async (req, reply) => {
    if (!requireSession(req, reply)) return;
    const r = loadRuntime();
    const excludedWallets = await readExclusionsFile();
    return {
      tokenMint: getEffectiveTokenMint(r),
      roundSystemEnabled: r.roundSystemEnabled,
      scheduledStartMs: r.scheduledStartMs,
      systemStatus: appState.systemStatus,
      hasHistory: history.length > 0,
      currentRoundId: appState.currentRound.roundId,
      nextBoundaryPreview: nextFullRoundBoundaryMs(Date.now()),
      excludedWallets,
    };
  });

  app.post("/api/admin/config", async (req, reply) => {
    if (!requireSession(req, reply)) return;
    const body = (req.body ?? {}) as { tokenMint?: string };
    const m = (body.tokenMint ?? "").trim();
    if (m && (m.length < 32 || m.length > 44)) {
      return reply.code(400).send({ error: "invalid_mint" });
    }
    const r = loadRuntime();
    const next: RuntimeConfig = { ...r, tokenMint: m };
    await saveRuntime(next);
    await saveTokenMintAndReload(m);
    return { ok: true, tokenMint: getEffectiveTokenMint(next) };
  });

  app.post("/api/admin/exclusions", async (req, reply) => {
    if (!requireSession(req, reply)) return;
    const body = (req.body ?? {}) as { addresses?: unknown };
    if (!Array.isArray(body.addresses)) {
      return reply.code(400).send({ error: "addresses_must_be_array" });
    }
    const strings = body.addresses.filter((x): x is string => typeof x === "string");
    const nonempty = strings.map((s) => s.trim()).filter(Boolean);
    const invalid = nonempty.filter((s) => !isPlausibleSolanaAddress(s));
    if (invalid.length > 0) {
      return reply.code(400).send({ error: "invalid_address", invalid: invalid.slice(0, 8) });
    }
    const written = await saveExclusions(nonempty);
    try {
      await refreshHolders();
    } catch (e) {
      app.log.error({ err: e }, "refreshHolders after exclusions save");
      return {
        ok: true,
        excludedWallets: written,
        refreshWarning: e instanceof Error ? e.message : String(e),
      };
    }
    return { ok: true, excludedWallets: written };
  });

  app.post("/api/admin/system/start", async (req, reply) => {
    if (!requireSession(req, reply)) return;
    const { nextBoundary, error } = await startRoundSystemFromAdmin();
    if (error) {
      return reply.code(400).send({ error, nextBoundary: nextBoundary || null });
    }
    return { ok: true, nextBoundary };
  });

  app.get("/api/admin/prize-test", async (req, reply) => {
    if (!requireSession(req, reply)) return;
    const live = getLivePrizeStatus();
    const runtime = loadRuntime();
    const tokenMint = getEffectiveTokenMint(runtime);
    const prize = await estimatePrizeLamports();
    return {
      ok: true,
      tokenMint,
      livePrizeEnabled: live.enabled,
      livePrizeDisabledReason: live.reason,
      unclaimedLamports: prize.amount,
      unclaimedSol: Number(prize.amount) / 1e9,
      readError: prize.error,
      readAtMs: Date.now(),
    };
  });
}
