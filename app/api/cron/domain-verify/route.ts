import { assertCronAccess } from "@/lib/cron";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import { logger } from "@/lib/logger";
import { refreshDomain } from "@/lib/projects/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    assertCronAccess(request);
    const db = getAdminDb();
    const snap = await db
      .collectionGroup(collections.domains)
      .where("status", "in", ["pending", "error"])
      .limit(40)
      .get();
    let checked = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      try {
        await refreshDomain(String(data.userId), String(data.projectId), String(data.domainId));
        checked += 1;
      } catch (error) {
        logger.warn("Domain verify cron skipped", {
          domainId: data.domainId,
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    return json({ ok: true, checked });
  } catch (error) {
    return handleRouteError(error, "cron.domains");
  }
}
