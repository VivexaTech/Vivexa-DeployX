import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { buildQuote, serializeQuote } from "@/lib/billing/checkout";

export const dynamic = "force-dynamic";

const schema = z.object({
  planId: z.string().uuid(),
  cycle: z.enum(["monthly", "yearly"]),
  coupon: z.string().trim().max(40).optional(),
  state: z.string().trim().min(1, "Select your state").max(60),
});

/** Server-calculated price preview. create-order recalculates independently. */
export const POST = withUser({ schema, rateLimit: { key: "billing-quote", limit: 60, windowMs: 60_000 } }, async ({ body }) => {
  const quote = await buildQuote({ planId: body.planId, cycle: body.cycle, couponCode: body.coupon, stateCode: body.state });
  return NextResponse.json({ quote: serializeQuote(quote) });
});
