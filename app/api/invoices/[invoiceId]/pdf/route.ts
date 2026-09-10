import { verifyRequestUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase/admin";
import { userInvoicesPath } from "@/lib/firebase/collections";
import { handleRouteError } from "@/lib/http";
import { generateInvoicePdf } from "@/lib/invoices/generate";
import type { Invoice } from "@/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    const { invoiceId } = await context.params;
    const snap = await getAdminDb().doc(`${userInvoicesPath(user.uid)}/${invoiceId}`).get();
    if (!snap.exists) throw new AppError("NOT_FOUND", "Invoice not found.", 404);
    const invoice = snap.data() as Invoice;
    const pdf = await generateInvoicePdf(invoice);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, "invoices.pdf");
  }
}
