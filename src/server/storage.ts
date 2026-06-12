import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * Server-only Supabase Storage helpers for person avatars.
 *
 * Uses the SERVICE ROLE key — it bypasses RLS and MUST never be imported into a
 * Client Component. It is only ever reached from the "use server" actions module,
 * so the service-role key never enters a client bundle.
 *
 * MVP model: a single public-read bucket `avatars`, server-side (service-role)
 * writes, public URLs stored in Person.photoUrl. Per-user folder RLS can be
 * tightened later (see plan's carried-forward notes).
 */

const AVATARS_BUCKET = "avatars";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase storage is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Idempotently ensure the public `avatars` bucket exists. createBucket returns an
 * error object (it does not throw) — we tolerate the "already exists" case and
 * rethrow anything else.
 */
export async function ensureAvatarsBucket(): Promise<void> {
  const supabase = serviceClient();
  const { error } = await supabase.storage.createBucket(AVATARS_BUCKET, {
    public: true,
  });
  if (!error) return;

  const message = error.message?.toLowerCase() ?? "";
  // Supabase returns a 409 / "already exists" / "Duplicate" when the bucket is present.
  if (message.includes("already exists") || message.includes("duplicate")) {
    return;
  }
  throw error;
}

/**
 * Upload `file` to avatars/<userId>/<uuid>.<ext> and return its public URL.
 * Caller is responsible for ensuring ownership of the person it's attached to.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = serviceClient();

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  const objectPath = `${userId}/${randomUUID()}${ext ? `.${ext}` : ""}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(objectPath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;

  const { data } = supabase.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(objectPath);
  return data.publicUrl;
}
