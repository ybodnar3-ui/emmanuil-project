-- Defense-in-depth: enable Row Level Security on every app table with NO policies.
-- With RLS enabled and no permissive policies, the public anon/PostgREST role is
-- denied all access. The `postgres` role Prisma connects as bypasses RLS by design
-- (BYPASSRLS), so the server-side data layer keeps working. App-layer userId scoping
-- (src/server/data/*) remains the primary guard; this is the secondary lock.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Interaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cadence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
