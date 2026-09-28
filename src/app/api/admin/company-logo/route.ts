import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withUser, jsonError } from "@/lib/security/api";
import { isAdminRole } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/data/audit";
import { randomToken } from "@/lib/utils/crypto";

export const dynamic = "force-dynamic";

const BUCKET = "branding";
const MAX_BYTES = 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Uploads a new company/invoice logo. Previous files are intentionally kept:
 * issued invoices reference the logo URL that was current when they were created.
 */
export const POST = withUser({ rateLimit: { key: "company-logo", limit: 10, windowMs: 60_000 } }, async ({ user, request }) => {
  if (!isAdminRole(user.profile.role)) return jsonError("Admin access required", 403);

  const form = await request.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File) || file.size === 0) return jsonError("Choose an image to upload.", 422);
  const ext = TYPES[file.type];
  if (!ext) return jsonError("Logo must be a PNG, JPEG or WebP image.", 422);
  if (file.size > MAX_BYTES) return jsonError("Logo must be 1 MB or smaller.", 422);

  const db = createAdminClient();
  const path = `company/logo-${Date.now()}-${randomToken(6).replace(/[^A-Za-z0-9]/g, "")}.${ext}`;
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (uploadError) {
    console.error("[company-logo] upload failed:", uploadError.message);
    return jsonError("Logo upload failed. Make sure the 'branding' storage bucket exists (run the latest migration).", 500);
  }

  const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await db
    .from("platform_settings")
    .upsert({ key: "company_logo_url", value: url, is_public: false, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return jsonError("Logo uploaded but the setting could not be saved.", 500);

  await recordAudit(user.id, "COMPANY_LOGO_UPDATED", "platform_settings", null, { path });
  revalidatePath("/admin/settings", "layout");
  return NextResponse.json({ url });
});
