import "@testing-library/jest-dom/vitest";

// Load .env into process.env for integration tests (e.g. the RLS test) when run
// locally. Guarded so CI without a .env file (and without these secrets) stays
// green — env-gated tests skip themselves when the vars are absent.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env present (e.g. CI) — env-gated integration tests will skip.
}
