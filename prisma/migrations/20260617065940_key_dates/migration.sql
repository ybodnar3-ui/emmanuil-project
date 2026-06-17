-- CreateTable
CREATE TABLE "KeyDate" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeyDate_personId_idx" ON "KeyDate"("personId");

-- AddForeignKey
ALTER TABLE "KeyDate" ADD CONSTRAINT "KeyDate_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defense-in-depth: enable RLS on the new table too (deny-by-default for the public
-- anon/PostgREST path), consistent with enable_rls. No policies; `postgres` (Prisma)
-- bypasses RLS. App-layer userId scoping remains the primary guard.
ALTER TABLE "KeyDate" ENABLE ROW LEVEL SECURITY;
