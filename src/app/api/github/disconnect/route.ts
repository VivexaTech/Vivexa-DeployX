import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/utils/crypto";

export const POST = withUser({}, async ({ user }) => {
  const admin = createAdminClient();
  const { data } = await admin.from("github_connections").select("access_token_encrypted").eq("user_id", user.id).maybeSingle();

  if (data && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    // Best-effort revocation of the OAuth grant on GitHub's side.
    try {
      const token = decryptSecret((data as { access_token_encrypted: string }).access_token_encrypted);
      const basic = Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString("base64");
      await fetch(`https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/grant`, {
        method: "DELETE",
        headers: { Authorization: `Basic ${basic}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
      });
    } catch {
      // Ignore — the local token is removed regardless.
    }
  }

  await admin.from("github_connections").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
});
