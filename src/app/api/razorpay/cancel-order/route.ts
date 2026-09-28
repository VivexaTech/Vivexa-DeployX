import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { createAdminClient } from "@/lib/supabase/admin";

/** Marks an unpaid order as cancelled when the user dismisses checkout. */
export const POST = withUser(
  { schema: z.object({ orderId: z.string().min(1).max(64), reason: z.string().max(300).optional() }) },
  async ({ user, body }) => {
    await createAdminClient()
      .from("payments")
      .update({ status: "cancelled", failure_reason: body.reason ?? "Checkout dismissed by user" })
      .eq("order_id", body.orderId)
      .eq("user_id", user.id)
      .eq("status", "created");
    return NextResponse.json({ ok: true });
  },
);
