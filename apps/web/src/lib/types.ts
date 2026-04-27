/** Mirrors apps/server REST JSON (v1 backendspec §8) */

export type SystemStatus = "off" | "scheduled" | "running";

export type ApiStateResponse = {
  system: {
    status: SystemStatus;
    tokenMint: string;
    scheduledStartMs: number | null;
    holdersFetchError: string | null;
    prizeFetchError?: string | null;
    mockHolders: boolean;
    /** True when eligible list is from server mock data, not RPC */
    holdersSnapshotMock?: boolean;
    /** On-chain token accounts for mint (before ≥0.2% filter) */
    holderTokenAccountCount?: number;
  };
  round: {
    roundId: number;
    startedAt: number;
    endsAt: number;
    secondsRemaining: number;
    phase: "live" | "drawing" | "payout_pending";
  };
  eligibleWallets: Array<{ address: string; balance: string; balancePct: number }>;
  eligibleCount: number;
  totalSupply: string;
  estimatedPrize: { amount: string; currency: string };
};

export type HistoricalRound = {
  roundId: number;
  startedAt: number;
  endedAt: number;
  seed: string;
  seedSource: string;
  totalSupply: string;
  eligibleWallets: string[];
  eligibleSnapshot?: Array<{ address: string; balance: string; balancePct: number }>;
  winner: string | null;
  prizeAmount: string;
  prizeCurrency: string;
  claimTx: string | null;
  payoutTx: string | null;
  status: string;
  eligibleCount: number;
  winnerIndex?: number | null;
};

export type StatsResponse = {
  totalRounds: number;
  totalPaidOut: { amount: string; currency: string };
  biggestWin: { amount: string; wallet: string; roundId: number };
  uniqueWinners: number;
};

export type ActivityEntry = {
  id: number;
  ts: number;
  type: string;
  roundId?: number;
  wallet?: string;
  meta?: Record<string, unknown>;
};
