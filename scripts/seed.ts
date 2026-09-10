import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

type SeedFile = {
  about: {
    support: Record<string, string>;
    company: Record<string, string>;
    reservedSubdomains: { names: string[] };
  };
  plans: Array<Record<string, unknown> & { id: string }>;
  projects: Array<Record<string, unknown> & { id?: string }>;
};

function required(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing ${names[0]}`);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: required("FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
      clientEmail: required("FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_CLIENT_EMAIL"),
      privateKey: required("FIREBASE_ADMIN_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const seed = JSON.parse(readFileSync(resolve(process.cwd(), "scripts/seed-data.json"), "utf8")) as SeedFile;

async function main() {
  const supportSnap = await db.doc("about/support").get();
  if (!supportSnap.exists) await db.doc("about/support").set(seed.about.support);
  const companySnap = await db.doc("about/company").get();
  if (!companySnap.exists) await db.doc("about/company").set(seed.about.company);
  const reservedSnap = await db.doc("about/reservedSubdomains").get();
  if (!reservedSnap.exists) await db.doc("about/reservedSubdomains").set(seed.about.reservedSubdomains);
  for (const plan of seed.plans) {
    const { id, ...data } = plan;
    await db.doc(`about/pricing/plans/${id}`).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
  }
  for (const project of seed.projects) {
    const id = project.id ?? `project-${Date.now()}`;
    await db.doc(`about/content/projects/${id}`).set({ ...project, createdAt: new Date().toISOString() }, { merge: true });
  }
  console.log("Seed complete. Pricing plans: starter, business, enterprise.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
