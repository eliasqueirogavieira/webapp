/**
 * Loads env for one-off scripts. Next.js auto-reads .env.local at runtime,
 * but tsx scripts don't — point dotenv at .env.local first, .env as fallback.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), file);
  if (existsSync(p)) config({ path: p, override: false });
}
