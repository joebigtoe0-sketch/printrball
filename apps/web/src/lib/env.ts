export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Printr trade UI — append mint from `/api/state.system.tokenMint` when set */
export const PRINTR_TRADE_BASE = "https://app.printr.money/trade";

export function printrTradeUrl(mint?: string | null): string {
  const m = mint?.trim();
  if (m) return `${PRINTR_TRADE_BASE}/${encodeURIComponent(m)}`;
  return PRINTR_TRADE_BASE;
}

export const TOKEN_TICKER = process.env.NEXT_PUBLIC_TOKEN_TICKER ?? "PRINTR";
export const CONTRACT_URL =
  process.env.NEXT_PUBLIC_CONTRACT_URL ?? "https://solscan.io";

export const SOLSCAN_CLUSTER = process.env.NEXT_PUBLIC_SOLSCAN_CLUSTER ?? "devnet";

export function solscanTx(sig: string) {
  return `https://solscan.io/tx/${sig}?cluster=${SOLSCAN_CLUSTER}`;
}
