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
let mockScheduleArmedAtMs: number | null = null;
let mockCarryIntoRoundLamports: bigint = 0n;
let mockCarryRoundId: number | null = null;
let liveRoundBaselineLamports: bigint = 0n;
let liveBaselineRoundId: number | null = null;

function toLamports(raw: string): bigint {
  try {
    const n = BigInt(raw);
    return n >= 0n ? n : 0n;
  } catch {
    return 0n;
  }
}

function useFullUnclaimedForCurrentRound(): boolean {
  return appState.currentRound.roundId === 1 && history.length === 0;
}

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
    const rawLive = await estimatePrizeLamports();
    const currentRaw = toLamports(rawLive.amount);
    const baseline = useFullUnclaimedForCurrentRound()
      ? 0n
      : liveBaselineRoundId === roundId
        ? liveRoundBaselineLamports
        : currentRaw;
    const roundPrize = currentRaw > baseline ? currentRaw - baseline : 0n;

    setPhase("payout_pending");
    const live = await claimAndPayoutWinner(winner, roundPrize.toString());
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
  liveRoundBaselineLamports = 0n;
  liveBaselineRoundId = null;
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
  if (!isLivePrizeEnabled()) {
    // Carry any pre-start mock accrual into round #1 instead of resetting to zero.
    mockCarryIntoRoundLamports = BigInt(mockPrizeProgressLamports(start));
    mockCarryRoundId = 1;
  } else {
    mockCarryIntoRoundLamports = 0n;
    mockCarryRoundId = null;
  }
  appState.systemStatus = "running";
  appState.scheduledStartMs = null;
  mockScheduleArmedAtMs = null;
  setPhase("live");
  setRoundWindow(1, start, start + config.roundLengthMs);
  liveRoundBaselineLamports = 0n;
  liveBaselineRoundId = null;
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

const MOCK_MIN_SOL_FULL = 15; // full 15m window
const MOCK_MAX_SOL_FULL = 30; // full 15m window
const MOCK_MIN_SOL_SHORT = 10; // very short pre-start window
const MOCK_MAX_SOL_SHORT = 20; // very short pre-start window

function pseudoUnit(seed: number): number {
  // Deterministic pseudo-random in [0,1) so target stays stable within a round.
  const x = Math.sin(seed * 12_989.127 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
}

function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 1e9));
}

function roundMockTargetLamports(roundKey: number, readiness: number): bigint {
  // readiness in [0,1]: 1 means full 15m runway (15-30 SOL), 0 means very short runway (10-20 SOL).
  const r = Math.max(0, Math.min(1, readiness));
  const minSol = MOCK_MIN_SOL_SHORT + (MOCK_MIN_SOL_FULL - MOCK_MIN_SOL_SHORT) * r;
  const maxSol = MOCK_MAX_SOL_SHORT + (MOCK_MAX_SOL_FULL - MOCK_MAX_SOL_SHORT) * r;
  const minLamports = solToLamports(minSol);
  const maxLamports = solToLamports(maxSol);
  const span = maxLamports - minLamports;
  const u = pseudoUnit(roundKey);
  return minLamports + BigInt(Math.floor(Number(span) * u));
}

function mockPrizeProgressLamports(now = Date.now()): string {
  let s = 0;
  let e = 0;
  let roundKey = 0;
  let readiness = 1;
  let baseCarry = 0n;

  if (appState.systemStatus === "running" && appState.currentRound.roundId >= 1) {
    s = appState.currentRound.startedAt;
    e = appState.currentRound.endsAt;
    roundKey = appState.currentRound.roundId;
    if (mockCarryRoundId === appState.currentRound.roundId) {
      baseCarry = mockCarryIntoRoundLamports;
    }
  } else if (appState.systemStatus === "scheduled" && appState.scheduledStartMs != null) {
    // Pre-round accumulation preview starts at the exact admin "Start" click.
    e = appState.scheduledStartMs;
    s = mockScheduleArmedAtMs ?? now;
    roundKey = 0;
    readiness = Math.max(0, Math.min(1, (e - s) / config.roundLengthMs));
  } else {
    return "0";
  }

  const span = e - s;
  if (span <= 0) return "0";
  if (now <= s) return "0";

  const target = roundMockTargetLamports(roundKey, readiness);
  if (now >= e) return (baseCarry + target).toString();

  const t = Math.max(0, Math.min(1, (now - s) / span));
  // Ease-out curve: grows faster at start, slower near end.
  const eased = 1 - (1 - t) ** 2;
  const gained = BigInt(Math.floor(Number(target) * eased));
  return (baseCarry + gained).toString();
}

export async function refreshPrizeEstimate() {
  if (!isLivePrizeEnabled()) {
    appState.estimatedPrize = { amount: mockPrizeProgressLamports(), currency: "SOL" };
    appState.prizeFetchError = null;
    return;
  }
  const prize = await estimatePrizeLamports();
  const raw = toLamports(prize.amount);
  let display = 0n;
  if (appState.systemStatus === "running" && appState.currentRound.roundId >= 1) {
    if (useFullUnclaimedForCurrentRound()) {
      liveBaselineRoundId = appState.currentRound.roundId;
      liveRoundBaselineLamports = 0n;
    } else if (liveBaselineRoundId !== appState.currentRound.roundId) {
      liveBaselineRoundId = appState.currentRound.roundId;
      liveRoundBaselineLamports = raw;
    }
    display = raw > liveRoundBaselineLamports ? raw - liveRoundBaselineLamports : 0n;
  } else if (appState.systemStatus === "scheduled" && history.length === 0) {
    // Before round #1 starts, show full currently unclaimed fees as preview.
    display = raw;
  } else {
    liveRoundBaselineLamports = 0n;
    liveBaselineRoundId = null;
  }
  appState.estimatedPrize = { amount: display.toString(), currency: "SOL" };
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
    liveRoundBaselineLamports = 0n;
    liveBaselineRoundId = null;
    if (Date.now() >= endsAt) {
      await maybeAdvanceRound();
    }
  } else if (runtime.roundSystemEnabled && runtime.scheduledStartMs != null) {
    const s = runtime.scheduledStartMs;
    if (now < s) {
      appState.systemStatus = "scheduled";
      appState.scheduledStartMs = s;
      mockScheduleArmedAtMs = now;
      setRoundWindow(0, 0, s);
      setPhase("live");
      liveRoundBaselineLamports = 0n;
      liveBaselineRoundId = null;
    } else {
      const w = resolveRoundOneWindow(s, now);
      appState.systemStatus = "running";
      appState.scheduledStartMs = null;
      setPhase("live");
      setRoundWindow(1, w.start, w.end);
      liveRoundBaselineLamports = 0n;
      liveBaselineRoundId = null;
      await saveRuntime({ ...runtime, scheduledStartMs: null });
      await appendActivity("round_started", { roundId: 1 });
      if (Date.now() >= w.end) {
        await maybeAdvanceRound();
      }
    }
  } else {
    appState.systemStatus = "off";
    appState.scheduledStartMs = null;
    mockScheduleArmedAtMs = null;
    mockCarryIntoRoundLamports = 0n;
    mockCarryRoundId = null;
    liveRoundBaselineLamports = 0n;
    liveBaselineRoundId = null;
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
  mockScheduleArmedAtMs = Date.now();
  mockCarryIntoRoundLamports = 0n;
  mockCarryRoundId = null;
  liveRoundBaselineLamports = 0n;
  liveBaselineRoundId = null;
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
