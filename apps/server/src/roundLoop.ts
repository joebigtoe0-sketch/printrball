import { randomBytes } from "node:crypto";
import { appendActivity } from "./activityLog.js";
import { config } from "./config.js";
import { getHolderSnapshot, defaultTotalSupply } from "./holders.js";
import { loadHistory, saveHistory, ensureDir } from "./persist.js";
import { claimAndPayoutWinner, estimatePrizeLamports, isLivePrizeEnabled } from "./prizeEngine.js";
import { getEffectiveTokenMint, loadRuntime, type RuntimeConfig, saveRuntime } from "./runtimeStore.js";
import {
  appState,
  history,
  replaceEligible,
  setHistory,
  setPhase,
  setRoundWindow,
  syncTokenMintField,
} from "./state.js";
import type { EligibleWallet, HistoricalRound } from "./types.js";

function align15Min(ms: number): number {
  const step = config.roundLengthMs;
  return Math.floor(ms / step) * step;
}

/** Next 15m boundary after `ms` (if `ms` is on a boundary, the *next* boundary) */
export function nextFullRoundBoundaryMs(ms: number, step: number = config.roundLengthMs): number {
  const c = Math.ceil(ms / step) * step;
  if (c === ms) return c + step;
  return c;
}

function prevAddresses(list: EligibleWallet[]): Set<string> {
  return new Set(list.map((w) => w.address));
}

async function emitHolderDiffs(prev: EligibleWallet[], next: EligibleWallet[], roundId: number) {
  if (prev.length === 0) return;
  const a = prevAddresses(prev);
  const b = prevAddresses(next);
  for (const addr of next) {
    if (!a.has(addr.address)) {
      await appendActivity("holder_joined", {
        roundId,
        wallet: addr.address,
        meta: { balancePct: addr.balancePct },
      });
    }
  }
  for (const addr of prev) {
    if (!b.has(addr.address)) {
      await appendActivity("holder_dropped", {
        roundId,
        wallet: addr.address,
      });
    }
  }
}

let prevEligible: EligibleWallet[] = [];

export async function executeDraw(): Promise<void> {
  const roundId = appState.currentRound.roundId;
  const startedAt = appState.currentRound.startedAt;
  const endedAt = Date.now();
  const supply = appState.totalSupply;
  const snapshot: EligibleWallet[] = [...appState.eligibleWallets].sort((x, y) =>
    x.address.localeCompare(y.address),
  );
  const addresses = snapshot.map((e) => e.address);

  setPhase("drawing");

  if (addresses.length === 0) {
    const voidRound: HistoricalRound = {
      roundId,
      startedAt,
      endedAt,
      seed: "00",
      seedSource: "crypto.randomBytes",
      totalSupply: supply,
      eligibleWallets: [],
      eligibleSnapshot: [],
      winner: null,
      prizeAmount: "0",
      prizeCurrency: "SOL",
      claimTx: null,
      payoutTx: null,
      status: "void",
      eligibleCount: 0,
      winnerIndex: null,
    };
    history.push(voidRound);
    await saveHistory(config.dataDir, history);
    await appendActivity("round_void", { roundId, meta: { message: "No eligible holders" } });
    setPhase("live");
    await startNextRoundFrom(endedAt);
    return;
  }

  const seedBuf = randomBytes(16);
  const seedHex = seedBuf.toString("hex");
  const idx = Number(BigInt(`0x${seedHex}`) % BigInt(addresses.length));
  const winner = addresses[idx]!;

  let claimTx: string | null = null;
  let payoutTx: string | null = null;
  let prizeAmount = config.mockPrizeLamports;
  let status: HistoricalRound["status"] = "paid";

  if (isLivePrizeEnabled()) {
    setPhase("payout_pending");
    const live = await claimAndPayoutWinner(winner);
    claimTx = live.claimTx;
    payoutTx = live.payoutTx;
    prizeAmount = live.prizeLamports;
    if (live.error || !payoutTx) {
      status = "failed";
      await appendActivity("payout_failed", {
        roundId,
        wallet: winner,
        meta: { error: live.error ?? "missing payout tx", claimTx, payoutTx, amount: prizeAmount },
      });
    }
  } else {
    claimTx = `MOCKCLAIM_${roundId}_${Date.now()}`;
    payoutTx = `MOCKPAYOUT_${roundId}_${Date.now()}`;
    prizeAmount = appState.estimatedPrize.amount || config.mockPrizeLamports;
  }

  const completed: HistoricalRound = {
    roundId,
    startedAt,
    endedAt,
    seed: seedHex,
    seedSource: "crypto.randomBytes",
    totalSupply: supply,
    eligibleWallets: [...addresses],
    eligibleSnapshot: snapshot,
    winner,
    prizeAmount,
    prizeCurrency: "SOL",
    claimTx,
    payoutTx,
    status,
    eligibleCount: addresses.length,
    winnerIndex: idx,
  };

  history.push(completed);
  await saveHistory(config.dataDir, history);
  await appendActivity("round_drawn", {
    roundId,
    wallet: winner,
    meta: { index: idx, eligibleCount: addresses.length },
  });
  await appendActivity("fees_claimed", {
    roundId,
    wallet: winner,
    meta: { amount: prizeAmount, tx: claimTx },
  });
  if (payoutTx) {
    await appendActivity("payout_sent", {
      roundId,
      wallet: winner,
      meta: { amount: prizeAmount, tx: payoutTx },
    });
  }

  setPhase("live");
  await startNextRoundFrom(endedAt);
}

async function startNextRoundFrom(prevEnd: number) {
  const nextId = appState.currentRound.roundId + 1;
  const startedAt = prevEnd;
  const endsAt = startedAt + config.roundLengthMs;
  setRoundWindow(nextId, startedAt, endsAt);
  await appendActivity("round_started", { roundId: nextId });
}

export async function maybeAdvanceRound() {
  if (appState.systemStatus !== "running") return;
  if (appState.phase !== "live") return;
  if (appState.currentRound.roundId < 1) return;
  while (Date.now() >= appState.currentRound.endsAt) {
    await executeDraw();
  }
}

export async function checkScheduledStart() {
  if (appState.systemStatus !== "scheduled" || appState.scheduledStartMs == null) return;
  if (Date.now() < appState.scheduledStartMs) return;
  await activateFirstRoundAt(appState.scheduledStartMs);
}

/**
 * Begin round 1 with window [start, start+step) and mark system running.
 */
export async function activateFirstRoundAt(start: number) {
  if (appState.systemStatus !== "scheduled") return;
  appState.systemStatus = "running";
  appState.scheduledStartMs = null;
  setPhase("live");
  setRoundWindow(1, start, start + config.roundLengthMs);
  const r = loadRuntime();
  await saveRuntime({ ...r, scheduledStartMs: null });
  await appendActivity("round_started", { roundId: 1 });
}

/**
 * If server restarts *after* the first scheduled time but the first 15m window is still in progress, align to
 * `scheduledStart`. If we are *past* that first window, jump to the current 15m slot.
 */
function resolveRoundOneWindow(scheduled: number, now: number) {
  const step = config.roundLengthMs;
  if (now < scheduled + step) {
    return { start: scheduled, end: scheduled + step };
  }
  const slotStart = Math.floor(now / step) * step;
  return { start: slotStart, end: slotStart + step };
}

function looksLikeRateLimit(msg: string | null): boolean {
  if (!msg) return false;
  return /429|rate limit|throttl|too many requests/i.test(msg);
}

const MOCK_MIN_SOL_LAMPORTS = 15_000_000_000n; // 15 SOL
const MOCK_MAX_SOL_LAMPORTS = 30_000_000_000n; // 30 SOL

function pseudoUnit(seed: number): number {
  // Deterministic pseudo-random in [0,1) so target stays stable within a round.
  const x = Math.sin(seed * 12_989.127 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
}

function roundMockTargetLamports(roundKey: number): bigint {
  const span = MOCK_MAX_SOL_LAMPORTS - MOCK_MIN_SOL_LAMPORTS;
  const u = pseudoUnit(roundKey);
  return MOCK_MIN_SOL_LAMPORTS + BigInt(Math.floor(Number(span) * u));
}

function mockPrizeProgressLamports(now = Date.now()): string {
  let s = 0;
  let e = 0;
  let roundKey = 0;

  if (appState.systemStatus === "running" && appState.currentRound.roundId >= 1) {
    s = appState.currentRound.startedAt;
    e = appState.currentRound.endsAt;
    roundKey = appState.currentRound.roundId;
  } else if (appState.systemStatus === "scheduled" && appState.scheduledStartMs != null) {
    // Pre-round accumulation preview: rewards keep accruing before the first round arms.
    e = appState.scheduledStartMs;
    s = e - config.roundLengthMs;
    roundKey = 0;
  } else {
    return "0";
  }

  const span = e - s;
  if (span <= 0) return "0";
  if (now <= s) return "0";

  const target = roundMockTargetLamports(roundKey);
  if (now >= e) return target.toString();

  const t = Math.max(0, Math.min(1, (now - s) / span));
  // Ease-out curve: grows faster at start, slower near end.
  const eased = 1 - (1 - t) ** 2;
  return BigInt(Math.floor(Number(target) * eased)).toString();
}

export async function refreshPrizeEstimate() {
  if (!isLivePrizeEnabled()) {
    appState.estimatedPrize = { amount: mockPrizeProgressLamports(), currency: "SOL" };
    appState.prizeFetchError = null;
    return;
  }
  const prize = await estimatePrizeLamports();
  appState.estimatedPrize = { amount: prize.amount, currency: "SOL" };
  appState.prizeFetchError = prize.error;
}

export async function refreshHolders() {
  syncTokenMintField();
  const snap = await getHolderSnapshot();
  appState.holdersSnapshotMock = snap.mock;

  const snapEmpty = snap.eligible.length === 0;
  const keepStale =
    snap.error != null &&
    looksLikeRateLimit(snap.error) &&
    snapEmpty &&
    prevEligible.length > 0 &&
    !snap.mock;

  if (keepStale) {
    appState.holdersFetchError = `${snap.error} Eligible list unchanged from last successful poll.`;
    if (snap.totalSupply && snap.totalSupply !== "0") {
      appState.totalSupply = snap.totalSupply;
    }
    return;
  }

  appState.holderTokenAccountCount = snap.tokenAccountCount ?? 0;
  appState.holdersFetchError = snap.error;
  appState.totalSupply = snap.totalSupply || defaultTotalSupply();
  const next = snap.eligible;
  const rid = appState.currentRound.roundId;
  await emitHolderDiffs(prevEligible, next, rid);
  prevEligible = next;
  replaceEligible(next);
}

export async function initRoundEngine() {
  await ensureDir(config.dataDir);
  const h = await loadHistory(config.dataDir);
  setHistory(h);
  const runtime = loadRuntime();
  const now = Date.now();
  const mint = getEffectiveTokenMint(runtime);
  appState.tokenMint = mint;
  const last = history.at(-1);

  if (last) {
    appState.systemStatus = "running";
    appState.scheduledStartMs = null;
    const nextId = last.roundId + 1;
    const startedAt = last.endedAt;
    const endsAt = startedAt + config.roundLengthMs;
    setRoundWindow(nextId, startedAt, endsAt);
    if (Date.now() >= endsAt) {
      await maybeAdvanceRound();
    }
  } else if (runtime.roundSystemEnabled && runtime.scheduledStartMs != null) {
    const s = runtime.scheduledStartMs;
    if (now < s) {
      appState.systemStatus = "scheduled";
      appState.scheduledStartMs = s;
      setRoundWindow(0, 0, s);
      setPhase("live");
    } else {
      const w = resolveRoundOneWindow(s, now);
      appState.systemStatus = "running";
      appState.scheduledStartMs = null;
      setPhase("live");
      setRoundWindow(1, w.start, w.end);
      await saveRuntime({ ...runtime, scheduledStartMs: null });
      await appendActivity("round_started", { roundId: 1 });
      if (Date.now() >= w.end) {
        await maybeAdvanceRound();
      }
    }
  } else {
    appState.systemStatus = "off";
    appState.scheduledStartMs = null;
    setRoundWindow(0, 0, 0);
    setPhase("live");
  }

  await refreshHolders();
  await refreshPrizeEstimate();
  prevEligible = [...appState.eligibleWallets];

  const incomplete = [...history].reverse().find((r) => r.claimTx && !r.payoutTx && r.status === "paid");
  if (incomplete) {
    incomplete.payoutTx = `MOCKPAYOUT_RESUME_${incomplete.roundId}_${Date.now()}`;
    await saveHistory(config.dataDir, history);
    await appendActivity("payout_sent", {
      roundId: incomplete.roundId,
      wallet: incomplete.winner ?? undefined,
      meta: { resumed: true },
    });
  }
}

export function startBackgroundTimers() {
  setInterval(() => {
    void (async () => {
      await checkScheduledStart();
      await maybeAdvanceRound();
    })();
  }, 1000);

  setInterval(() => {
    void refreshHolders();
  }, config.holderPollMs);

  setInterval(() => {
    void refreshPrizeEstimate();
  }, config.prizePollMs);
}

/** After admin changes runtime, resync a few in-memory fields */
export async function startRoundSystemFromAdmin(): Promise<{ nextBoundary: number; error: string | null }> {
  if (history.length > 0 || (appState.systemStatus === "running" && appState.currentRound.roundId >= 1)) {
    return { nextBoundary: 0, error: "Round system is already running" };
  }
  const r = loadRuntime();
  if (!getEffectiveTokenMint(r)) {
    return { nextBoundary: 0, error: "Set token (mint) address first" };
  }
  const next = nextFullRoundBoundaryMs(Date.now());
  const nextR: RuntimeConfig = {
    ...r,
    roundSystemEnabled: true,
    scheduledStartMs: next,
  };
  await saveRuntime(nextR);
  appState.systemStatus = "scheduled";
  appState.scheduledStartMs = next;
  setPhase("live");
  setRoundWindow(0, 0, next);
  return { nextBoundary: next, error: null };
}

export async function saveTokenMintAndReload(mint: string) {
  const r = loadRuntime();
  const next: RuntimeConfig = { ...r, tokenMint: mint.trim() };
  await saveRuntime(next);
  appState.tokenMint = getEffectiveTokenMint(next);
  await refreshHolders();
}
