import { readFileSync } from "fs";
import { resolve } from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type SeedFile = {
  about: {
    support: Record<string, string>;
    company: Record<string, string>;
    reservedSubdomains: { names: string[] };
  };
  plans: Array<Record<string, unknown> & { id: string }>;
  projects: Array<Record<string, unknown> & { id?: string }>;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: required("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: required("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: required("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const seed = JSON.parse(readFileSync(resolve(process.cwd(), "scripts/seed-data.json"), "utf8")) as SeedFile;

async function main() {
  await db.doc("about/support").set(seed.about.support, { merge: true });
  await db.doc("about/company").set(seed.about.company, { merge: true });
  await db.doc("about/reservedSubdomains").set(seed.about.reservedSubdomains, { merge: true });
  for (const plan of seed.plans) {
    const { id, ...data } = plan;
    await db.doc(`about/pricing/plans/${id}`).set(data, { merge: true });
  }
  for (const project of seed.projects) {
    const id = project.id ?? `project-${Date.now()}`;
    await db.doc(`about/content/projects/${id}`).set({ ...project, createdAt: new Date().toISOString() }, { merge: true });
  }
  console.log("Seed complete. Replace placeholder pricing and support values before going live.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
