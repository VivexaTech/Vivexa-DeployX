import { requireAdmin } from "@/lib/auth/admin";
import { verifyRequestUser } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";
import { aboutDocs, collections, pricingPlansPath, showcaseProjectsPath } from "@/lib/firebase/collections";
import { handleRouteError, json, readJson } from "@/lib/http";
import { nowIso } from "@/lib/utils";
import {
  adminCompanySchema,
  adminPlanSchema,
  adminShowcaseSchema,
  adminSupportSchema,
} from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = requireAdmin(await verifyRequestUser(request));
    const db = getAdminDb();
    const [support, company, reserved, plans, projects] = await Promise.all([
      db.collection(collections.about).doc(aboutDocs.support).get(),
      db.collection(collections.about).doc(aboutDocs.company).get(),
      db.collection(collections.about).doc(aboutDocs.reservedSubdomains).get(),
      db.collection(pricingPlansPath()).get(),
      db.collection(showcaseProjectsPath()).get(),
    ]);
    return json({
      admin: user.uid,
      support: support.data() ?? null,
      company: company.data() ?? null,
      reservedSubdomains: reserved.data()?.names ?? [],
      plans: plans.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      projects: projects.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch (error) {
    return handleRouteError(error, "admin.get");
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(await verifyRequestUser(request));
    const body = z
      .object({
        kind: z.enum(["support", "company", "reserved", "plan", "project", "deletePlan", "deleteProject"]),
        data: z.unknown(),
      })
      .parse(await readJson(request));
    const db = getAdminDb();

    if (body.kind === "support") {
      const data = adminSupportSchema.parse(body.data);
      await db.collection(collections.about).doc(aboutDocs.support).set(data, { merge: true });
    }
    if (body.kind === "company") {
      const data = adminCompanySchema.parse(body.data);
      await db.collection(collections.about).doc(aboutDocs.company).set(data, { merge: true });
    }
    if (body.kind === "reserved") {
      const data = z.object({ names: z.array(z.string()) }).parse(body.data);
      await db.collection(collections.about).doc(aboutDocs.reservedSubdomains).set({
        names: data.names.map((item) => item.toLowerCase()),
      });
    }
    if (body.kind === "plan") {
      const data = adminPlanSchema.parse(body.data);
      const id = data.id ?? data.planName.toLowerCase().replace(/\s+/g, "-");
      await db.collection(pricingPlansPath()).doc(id).set({ ...data, updatedAt: nowIso() }, { merge: true });
    }
    if (body.kind === "project") {
      const data = adminShowcaseSchema.parse(body.data);
      const id = data.id ?? data.title.toLowerCase().replace(/\s+/g, "-");
      await db.collection(showcaseProjectsPath()).doc(id).set(
        { ...data, createdAt: nowIso() },
        { merge: true },
      );
    }
    if (body.kind === "deletePlan") {
      const data = z.object({ id: z.string() }).parse(body.data);
      await db.collection(pricingPlansPath()).doc(data.id).delete();
    }
    if (body.kind === "deleteProject") {
      const data = z.object({ id: z.string() }).parse(body.data);
      await db.collection(showcaseProjectsPath()).doc(data.id).delete();
    }
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "admin.save");
  }
}
