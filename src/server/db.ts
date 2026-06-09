import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 driver adapter. PrismaPg accepts a pg.Pool | pg.PoolConfig | string;
// we pass a PoolConfig ({ connectionString }) and let the adapter own the pool.
// Connects via the Supabase pooler as `postgres` (server-only, bypasses RLS by design).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
