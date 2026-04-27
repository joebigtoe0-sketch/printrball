import type { FastifyInstance } from "fastify";
import { appState, history, secondsRemaining } from "./state.js";
import { loadActivity } from "./persist.js";
import { config } from "./config.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.get("/api/state", async () => {
    const eligible = appState.eligibleWallets;
    return {
      system: {
        status: appState.systemStatus,
        tokenMint: appState.tokenMint,
        scheduledStartMs: appState.scheduledStartMs,
        holdersFetchError: appState.holdersFetchError,
        prizeFetchError: appState.prizeFetchError,
        mockHolders: config.mockHolders,
        holdersSnapshotMock: appState.holdersSnapshotMock,
        holderTokenAccountCount: appState.holderTokenAccountCount,
      },
      round: {
        roundId: appState.currentRound.roundId,
        startedAt: appState.currentRound.startedAt,
        endsAt: appState.currentRound.endsAt,
        secondsRemaining: secondsRemaining(),
        phase: appState.phase,
      },
      eligibleWallets: eligible.map((e) => ({
        address: e.address,
        balance: e.balance,
        balancePct: e.balancePct,
      })),
      eligibleCount: eligible.length,
      totalSupply: appState.totalSupply,
      estimatedPrize: appState.estimatedPrize,
    };
  });

  app.get("/api/history", async (req) => {
    const q = req.query as { limit?: string };
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));
    const slice = history.slice(-limit).reverse();
    return { items: slice };
  });

  app.get("/api/round/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
    const row = history.find((h) => h.roundId === id);
    if (!row) return reply.code(404).send({ error: "not found" });
    const snap =
      row.eligibleSnapshot?.length
        ? row.eligibleSnapshot
        : row.eligibleWallets.map((address) => ({
            address,
            balance: "0",
            balancePct: 0,
          }));
    return { ...row, eligibleSnapshot: snap };
  });

  app.get("/api/stats", async () => {
    const paid = history.filter((h) => h.status === "paid" && h.winner);
    let totalLamports = 0n;
    let biggest = 0n;
    let biggestWallet = "";
    let biggestRoundId = 0;
    const winners = new Set<string>();
    for (const h of paid) {
      const amt = BigInt(h.prizeAmount || "0");
      totalLamports += amt;
      if (amt > biggest) {
        biggest = amt;
        biggestWallet = h.winner ?? "";
        biggestRoundId = h.roundId;
      }
      if (h.winner) winners.add(h.winner);
    }
    return {
      totalRounds: history.length,
      totalPaidOut: { amount: totalLamports.toString(), currency: "SOL" },
      biggestWin: { amount: biggest.toString(), wallet: biggestWallet, roundId: biggestRoundId },
      uniqueWinners: winners.size,
    };
  });

  app.get("/api/activity", async (req) => {
    const q = req.query as { limit?: string };
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50)));
    const rows = await loadActivity(config.dataDir);
    return rows.slice(0, limit);
  });
}
