import { verifyRequestUser } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json, readJson } from "@/lib/http";
import { nowIso } from "@/lib/utils";
import { profileUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    const body = profileUpdateSchema.parse(await readJson(request));
    await getAdminDb().collection(collections.users).doc(session.uid).set(
      { name: body.name, updatedAt: nowIso() },
      { merge: true },
    );
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "profile");
  }
}
