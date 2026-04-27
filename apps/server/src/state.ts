import type { AppState, EligibleWallet, HistoricalRound } from "./types.js";
import { config } from "./config.js";
import { defaultTotalSupply } from "./holders.js";
import { getEffectiveTokenMint, loadRuntime } from "./runtimeStore.js";

const rt = () => getEffectiveTokenMint(loadRuntime());

export const appState: AppState = {
  currentRound: {
    roundId: 0,
    startedAt: 0,
    endsAt: 0,
  },
  eligibleWallets: [],
  totalSupply: defaultTotalSupply(),
  estimatedPrize: { amount: config.mockPrizeLamports, currency: "SOL" },
  phase: "live",
  systemStatus: "off",
  scheduledStartMs: null,
  tokenMint: rt(),
  holdersFetchError: null,
  holdersSnapshotMock: false,
  holderTokenAccountCount: 0,
  prizeFetchError: null,
};

export let history: HistoricalRound[] = [];

export function setHistory(rows: HistoricalRound[]) {
  history = rows;
}

export function replaceEligible(next: EligibleWallet[]) {
  appState.eligibleWallets = next;
}

export function setPhase(phase: AppState["phase"]) {
  appState.phase = phase;
}

export function setRoundWindow(roundId: number, startedAt: number, endsAt: number) {
  appState.currentRound.roundId = roundId;
  appState.currentRound.startedAt = startedAt;
  appState.currentRound.endsAt = endsAt;
}

export function secondsRemaining(): number {
  const e = appState.currentRound.endsAt;
  if (appState.currentRound.roundId === 0 && e <= 0) return 0;
  return Math.max(0, Math.ceil((e - Date.now()) / 1000));
}

export function syncTokenMintField() {
  appState.tokenMint = getEffectiveTokenMint(loadRuntime());
}
