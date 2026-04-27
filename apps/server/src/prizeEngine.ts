import bs58 from "bs58";
import BN from "bn.js";
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
  return process.env.METEORA_LIVE_ENABLED === "1" && Boolean(process.env.TREASURY_PRIVATE_KEY?.trim());
}

function setup() {
  const secret = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!secret) throw new Error("TREASURY_PRIVATE_KEY is missing");
  const wallet = parseKeypair(secret);
  const connection = new Connection(getJsonRpcUrl(), "confirmed");
  const cpAmm = new CpAmm(connection);
  return { wallet, connection, cpAmm };
}

async function claimableForPosition(cpAmm: CpAmm, p: PositionLike): Promise<{ lamports: BN; poolState: PoolLike }> {
  const poolState = (await cpAmm.fetchPoolState(p.positionState.pool)) as unknown as PoolLike;
  const unclaimed = getUnClaimLpFee(poolState as never, p.positionState as never) as unknown as UnclaimedLike;
  if (isWsolMint(poolState.tokenAMint)) return { lamports: unclaimed.feeTokenA, poolState };
  if (isWsolMint(poolState.tokenBMint)) return { lamports: unclaimed.feeTokenB, poolState };
  return { lamports: new BN(0), poolState };
}

export async function estimatePrizeLamports(): Promise<{ amount: string; error: string | null }> {
  if (!isLivePrizeEnabled()) return { amount: config.mockPrizeLamports, error: null };
  try {
    const { cpAmm, wallet } = setup();
    const positions = (await cpAmm.getPositionsByUser(wallet.publicKey)) as unknown as PositionLike[];
    let total = new BN(0);
    for (const p of positions) {
      const { lamports } = await claimableForPosition(cpAmm, p);
      total = total.add(lamports);
    }
    return { amount: total.toString(), error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { amount: "0", error: msg };
  }
}

export async function claimAndPayoutWinner(
  winnerAddress: string,
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
    const target = BigInt(claimableTotal.toString());
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
