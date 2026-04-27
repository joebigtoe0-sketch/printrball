/**
 * Deletes persisted round state so the server boots in systemStatus "off" until admin Start.
 * Run from repo: pnpm --filter @powerball/server reset-live
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPkg = path.join(__dirname, "..");
const repoRoot = path.join(serverPkg, "..", "..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(serverPkg, ".env"), override: true });

const raw = process.env.DATA_DIR?.trim() || "data";
const dataDir = path.isAbsolute(raw) ? raw : path.resolve(serverPkg, raw);

for (const f of ["history.json", "activity.json", "runtime.json"]) {
  const p = path.join(dataDir, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log("removed", p);
  }
}

console.log("Done. Restart the API — home page stays STANDBY until you set mint and press Start in /admin.");
