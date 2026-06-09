import { defineConfig } from "prisma/config";

// Prisma 7 does not auto-load .env; load it explicitly for the CLI (migrate/generate).
// Node 20.12+ provides process.loadEnvFile (no dotenv dependency needed).
try {
  process.loadEnvFile(".env");
} catch {
  // .env may be absent in CI; rely on process.env in that case.
}

// The Prisma CLI (migrations) uses datasource.url. Supabase's transaction pooler
// (DATABASE_URL, port 6543, pgbouncer) does NOT support DDL reliably, so migrations
// must run over the session pooler / direct connection (DIRECT_URL, port 5432).
// The runtime client (src/server/db.ts) uses DATABASE_URL via the @prisma/adapter-pg pool.
export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
