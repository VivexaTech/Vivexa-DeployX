import { DEFAULT_RESERVED_SUBDOMAINS } from "@/config/constants";
import { getReservedSubdomains } from "@/lib/content/public";
import { getMainDomain } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { assertCleanSubdomain, normalizeSubdomain } from "@/lib/validation";
import { nowIso } from "@/lib/utils";

export async function getAllReservedSubdomains() {
  const configured = await getReservedSubdomains();
  return Array.from(new Set([...DEFAULT_RESERVED_SUBDOMAINS, ...configured.map((item) => item.toLowerCase())]));
}

export function platformHostname(subdomain: string) {
  return `${subdomain}.${getMainDomain()}`;
}

export async function claimSubdomain(input: {
  subdomain: string;
  uid: string;
  projectId: string;
}) {
  const reserved = await getAllReservedSubdomains();
  const value = assertCleanSubdomain(normalizeSubdomain(input.subdomain), reserved);
  const hostname = platformHostname(value);
  const db = getAdminDb();
  const ref = db.collection(collections.subdomainIndex).doc(value);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data()?.projectId !== input.projectId) {
      throw new AppError("CONFLICT", "That subdomain is already in use.", 409);
    }
    tx.set(ref, {
      subdomain: value,
      hostname,
      uid: input.uid,
      projectId: input.projectId,
      createdAt: snap.data()?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    });
  });
  return { subdomain: value, hostname };
}

export async function releaseSubdomain(subdomain: string, projectId: string) {
  const db = getAdminDb();
  const ref = db.collection(collections.subdomainIndex).doc(subdomain);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.projectId === projectId) {
    await ref.delete();
  }
}
