import bs58 from "bs58";
import BN from "bn.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { CpAmm, getUnClaimLpFee } from "@meteora-ag/cp-amm-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { config, getJsonRpcUrl } from "./config.js";
import { getEffectiveTokenMint, loadRuntime } from "./runtimeStore.js";

const WSOL_MINT = "So11111111111111111111111111111111111111112";

type PositionLike = {
  position: PublicKey;
  positionNftAccount: PublicKey;
  positionState: { pool: PublicKey };
};

type PoolLike = {
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  tokenAProgram: PublicKey;
  tokenBProgram: PublicKey;
};

type UnclaimedLike = {
  feeTokenA: BN;
  feeTokenB: BN;
};

type PrizeReadDebug = {
  selectedSource: "dbc" | "damm-v2" | "none";
  amount: string;
  error: string | null;
  mint: string;
  rpcUrl: string;
  dbc: {
    attempted: boolean;
    poolAddress: string | null;
    amount: string | null;
    error: string | null;
  };
  damm: {
    attempted: boolean;
    positions: number;
    amount: string | null;
    error: string | null;
  };
};

function parseKeypair(raw: string): Keypair {
  const t = raw.trim();
  if (t.startsWith("[")) {
    const arr = JSON.parse(t) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  return Keypair.fromSecretKey(bs58.decode(t));
}

function isWsolMint(pk: PublicKey): boolean {
  return pk.toBase58() === WSOL_MINT;
}

export function isLivePrizeEnabled(): boolean {
  return config.meteoraLiveEnabled && Boolean(process.env.TREASURY_PRIVATE_KEY?.trim());
}

export function getLivePrizeStatus(): { enabled: boolean; reason: string | null } {
  if (!config.meteoraLiveEnabled) {
    return { enabled: false, reason: "METEORA_LIVE_ENABLED is false/off" };
  }
  if (!process.env.TREASURY_PRIVATE_KEY?.trim()) {
    return { enabled: false, reason: "TREASURY_PRIVATE_KEY is missing" };
  }
  return { enabled: true, reason: null };
}

function setup() {
  const secret = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!secret) throw new Error("TREASURY_PRIVATE_KEY is missing");
  const wallet = parseKeypair(secret);
  const connection = new Connection(getJsonRpcUrl(), "confirmed");
  const dbc = new DynamicBondingCurveClient(connection, "confirmed");
  const cpAmm = new CpAmm(connection);
  return { wallet, connection, cpAmm, dbc };
}

async function claimableForPosition(cpAmm: CpAmm, p: PositionLike): Promise<{ lamports: BN; poolState: PoolLike }> {
  const poolState = (await cpAmm.fetchPoolState(p.positionState.pool)) as unknown as PoolLike;
  const unclaimed = getUnClaimLpFee(poolState as never, p.positionState as never) as unknown as UnclaimedLike;
  if (isWsolMint(poolState.tokenAMint)) return { lamports: unclaimed.feeTokenA, poolState };
  if (isWsolMint(poolState.tokenBMint)) return { lamports: unclaimed.feeTokenB, poolState };
  return { lamports: new BN(0), poolState };
}

async function readPrizeDebug(): Promise<PrizeReadDebug> {
  const { cpAmm, wallet, dbc } = setup();
  const mint = getEffectiveTokenMint(loadRuntime());
  const rpcUrl = getJsonRpcUrl();
  const debug: PrizeReadDebug = {
    selectedSource: "none",
    amount: "0",
    error: null,
    mint,
    rpcUrl,
    dbc: {
      attempted: false,
      poolAddress: null,
      amount: null,
      error: null,
    },
    damm: {
      attempted: false,
      positions: 0,
      amount: null,
      error: null,
    },
  };

  if (mint) {
    debug.dbc.attempted = true;
    try {
      const pool = await dbc.state.getPoolByBaseMint(mint);
      if (pool?.publicKey) {
        const poolAddress = pool.publicKey.toBase58();
        debug.dbc.poolAddress = poolAddress;
        const fee = await dbc.state.getPoolFeeBreakdown(poolAddress);
        debug.dbc.amount = fee.creator.unclaimedQuoteFee.toString();
        debug.selectedSource = "dbc";
        debug.amount = debug.dbc.amount;
        return debug;
      }
      debug.dbc.error = "No DBC pool found for mint";
    } catch (e) {
      debug.dbc.error = e instanceof Error ? e.message : String(e);
    }
  } else {
    debug.dbc.error = "Token mint is empty";
  }

  debug.damm.attempted = true;
  try {
    const positions = (await cpAmm.getPositionsByUser(wallet.publicKey)) as unknown as PositionLike[];
    debug.damm.positions = positions.length;
    let total = new BN(0);
    for (const p of positions) {
      const { lamports } = await claimableForPosition(cpAmm, p);
      total = total.add(lamports);
    }
    debug.damm.amount = total.toString();
    debug.selectedSource = "damm-v2";
    debug.amount = debug.damm.amount;
    if (debug.dbc.error) {
      debug.error = `DBC fallback: ${debug.dbc.error}`;
    }
    return debug;
  } catch (e) {
    debug.damm.error = e instanceof Error ? e.message : String(e);
    debug.error = [debug.dbc.error, debug.damm.error].filter(Boolean).join(" | ") || "Prize read failed";
    return debug;
  }
}

export async function estimatePrizeLamports(): Promise<{ amount: string; error: string | null }> {
  if (!isLivePrizeEnabled()) return { amount: config.mockPrizeLamports, error: null };
  try {
    const debug = await readPrizeDebug();
    return { amount: debug.amount, error: debug.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { amount: "0", error: msg };
  }
}

export async function debugPrizeRead(): Promise<PrizeReadDebug> {
  if (!isLivePrizeEnabled()) {
    return {
      selectedSource: "none",
      amount: config.mockPrizeLamports,
      error: "Live prize mode is disabled",
      mint: getEffectiveTokenMint(loadRuntime()),
      rpcUrl: getJsonRpcUrl(),
      dbc: { attempted: false, poolAddress: null, amount: null, error: null },
      damm: { attempted: false, positions: 0, amount: null, error: null },
    };
  }
  return readPrizeDebug();
}

export async function claimAndPayoutWinner(
  winnerAddress: string,
  payoutTargetLamports?: string,
): Promise<{ claimTx: string | null; payoutTx: string | null; prizeLamports: string; error: string | null }> {
  if (!isLivePrizeEnabled()) {
    return { claimTx: null, payoutTx: null, prizeLamports: config.mockPrizeLamports, error: null };
  }
  try {
    const minClaim = new BN(process.env.MIN_CLAIM_LAMPORTS ?? "1");
    const reserveLamports = BigInt(process.env.PAYOUT_RESERVE_LAMPORTS ?? "2500000");
    const { cpAmm, wallet, connection } = setup();
    const positions = (await cpAmm.getPositionsByUser(wallet.publicKey)) as unknown as PositionLike[];

    let claimTx: string | null = null;
    let claimableTotal = new BN(0);
    for (const p of positions) {
      const { lamports, poolState } = await claimableForPosition(cpAmm, p);
      claimableTotal = claimableTotal.add(lamports);
      if (lamports.lte(minClaim)) continue;
      const tx = await cpAmm.claimPositionFee2({
        owner: wallet.publicKey,
        pool: p.positionState.pool,
        position: p.position,
        positionNftAccount: p.positionNftAccount,
        receiver: wallet.publicKey,
        tokenAVault: poolState.tokenAVault,
        tokenBVault: poolState.tokenBVault,
        tokenAMint: poolState.tokenAMint,
        tokenBMint: poolState.tokenBMint,
        tokenAProgram: poolState.tokenAProgram,
        tokenBProgram: poolState.tokenBProgram,
      });
      claimTx = await sendAndConfirmTransaction(connection, tx as Transaction, [wallet], { commitment: "confirmed" });
    }

    const winner = new PublicKey(winnerAddress);
    const bal = BigInt(await connection.getBalance(wallet.publicKey, "confirmed"));
    const maxSendable = bal > reserveLamports ? bal - reserveLamports : 0n;
    const target = payoutTargetLamports != null ? BigInt(payoutTargetLamports) : BigInt(claimableTotal.toString());
    const sendAmount = target < maxSendable ? target : maxSendable;

    if (sendAmount <= 0n) {
      return { claimTx, payoutTx: null, prizeLamports: "0", error: "No SOL available to transfer after reserve" };
    }
    if (sendAmount > BigInt(Number.MAX_SAFE_INTEGER)) {
      return { claimTx, payoutTx: null, prizeLamports: "0", error: "Computed payout exceeds JS safe integer range" };
    }

    const payout = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: winner,
        lamports: Number(sendAmount),
      }),
    );
    const payoutTx = await sendAndConfirmTransaction(connection, payout, [wallet], { commitment: "confirmed" });
    return { claimTx, payoutTx, prizeLamports: sendAmount.toString(), error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { claimTx: null, payoutTx: null, prizeLamports: "0", error: msg };
  }
}
