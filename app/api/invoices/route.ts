import { verifyRequestUser } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";
import { userInvoicesPath } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import type { Invoice } from "@/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    const snap = await getAdminDb()
      .collection(userInvoicesPath(user.uid))
      .orderBy("createdAt", "desc")
      .get();
    return json({ invoices: snap.docs.map((doc) => doc.data() as Invoice) });
  } catch (error) {
    return handleRouteError(error, "invoices.list");
  }
}
