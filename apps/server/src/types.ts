export type SystemStatus = "off" | "scheduled" | "running";

/** In-memory + API shape (backendspec §3 / §8) */
export type AppState = {
  currentRound: {
    roundId: number;
    startedAt: number;
    endsAt: number;
  };
  /** Sorted eligible addresses at last poll */
  eligibleWallets: EligibleWallet[];
  totalSupply: string;
  estimatedPrize: { amount: string; currency: string };
  /** drawing | live | payout_pending (only when system is running) */
  phase: "live" | "drawing" | "payout_pending";
  /** Rounds are idle until admin starts, then can wait for the next 15m boundary */
  systemStatus: SystemStatus;
  /** When status is "scheduled", Unix ms when round #1 will begin */
  scheduledStartMs: number | null;
  /** Last fetched mint (from runtime or env) */
  tokenMint: string;
  /** Set when SPL holder fetch failed (on-chain path) */
  holdersFetchError: string | null;
  /** True when the last holder poll used built-in mock data (not on-chain) */
  holdersSnapshotMock: boolean;
  /** Parsed SPL token accounts for the mint (before ≥0.2% rule); 0 if unknown / mock */
  holderTokenAccountCount: number;
  /** Last Meteora prize poll error (null when latest poll succeeded) */
  prizeFetchError: string | null;
};

export type EligibleWallet = {
  address: string;
  balance: string;
  balancePct: number;
};

export type HistoricalRound = {
  roundId: number;
  startedAt: number;
  endedAt: number;
  seed: string;
  seedSource: "crypto.randomBytes" | "solana_blockhash" | "switchboard_vrf";
  totalSupply: string;
  /** Sorted addresses at draw (reproducible index) */
  eligibleWallets: string[];
  /** Full rows at draw time for verify CSV */
  eligibleSnapshot?: EligibleWallet[];
  winner: string | null;
  prizeAmount: string;
  prizeCurrency: "SOL" | string;
  claimTx: string | null;
  payoutTx: string | null;
  status: "paid" | "void" | "failed";
  eligibleCount: number;
  /** Index into sorted eligibleWallets used for winner selection */
  winnerIndex?: number | null;
};

export type ActivityType =
  | "round_started"
  | "holder_joined"
  | "holder_dropped"
  | "round_drawn"
  | "fees_claimed"
  | "payout_sent"
  | "payout_failed"
  | "round_void";

export type ActivityEntry = {
  id: number;
  ts: number;
  type: ActivityType;
  roundId?: number;
  wallet?: string;
  meta?: Record<string, unknown>;
};
