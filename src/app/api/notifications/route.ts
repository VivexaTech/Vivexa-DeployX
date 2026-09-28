import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const GET = withUser({}, async ({ user }) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return NextResponse.json({ notifications: data ?? [] });
});

export const POST = withUser(
  { schema: z.union([z.object({ id: z.string().uuid() }), z.object({ all: z.literal(true) })]) },
  async ({ user, body }) => {
    const supabase = await createClient();
    let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    if ("id" in body) query = query.eq("id", body.id);
    await query;
    return NextResponse.json({ ok: true });
  },
);
