import { defineConfig } from "prisma/config";

// Connection URLs are sourced from environment variables.
// Set DATABASE_URL in .env (see .env.example).
// Phase 2 wires up Supabase Postgres; Phase 1 only defines the datasource config.
export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
