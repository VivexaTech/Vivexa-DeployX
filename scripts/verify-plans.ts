import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mapPricingPlan, sortPricingPlans } from "../lib/content/plans";

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

function firstEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

const seed = JSON.parse(readFileSync(resolve(process.cwd(), "scripts/seed-data.json"), "utf8")) as {
  plans: Array<Record<string, unknown> & { id: string }>;
};

function summarize(plan: ReturnType<typeof mapPricingPlan>) {
  return {
    id: plan.id,
    planName: plan.planName,
    planPrice: plan.planPrice,
    currency: plan.currency,
    duration: plan.duration,
    maxWebsites: plan.maxWebsites,
    displayOrder: plan.displayOrder,
    keyPoints: plan.keyPoints,
    features: {
      freeSubdomain: plan.features.freeSubdomain,
      customDomain: plan.features.customDomain,
      staticWebsite: plan.features.staticWebsite,
      dynamicWebsite: plan.features.dynamicWebsite,
      githubDeployment: plan.features.githubDeployment,
    },
  };
}

async function main() {
  const fromSeed = sortPricingPlans(seed.plans.map((plan) => mapPricingPlan(plan.id, plan)));
  console.log("seed catalog", JSON.stringify(fromSeed.map(summarize), null, 2));

  const starter = fromSeed.find((plan) => plan.id === "starter");
  const business = fromSeed.find((plan) => plan.id === "business");
  const enterprise = fromSeed.find((plan) => plan.id === "enterprise");
  if (!starter || !business || !enterprise) throw new Error("Seed catalog must include starter, business, and enterprise");
  if (starter.features.dynamicWebsite) throw new Error("Starter must not allow dynamic websites");
  if (!business.features.dynamicWebsite || !enterprise.features.dynamicWebsite) {
    throw new Error("Business and Enterprise must allow dynamic websites");
  }
  if (starter.maxWebsites !== 1 || business.maxWebsites !== 3 || enterprise.maxWebsites !== 20) {
    throw new Error("Website limits must come from the plan documents");
  }
  if (fromSeed.map((plan) => plan.id).join(",") !== "starter,business,enterprise") {
    throw new Error(`Unexpected seed order: ${fromSeed.map((plan) => plan.id).join(",")}`);
  }

  const projectId = firstEnv("FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const clientEmail = firstEnv("FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_CLIENT_EMAIL");
  const privateKey = firstEnv("FIREBASE_ADMIN_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY");
  if (!projectId || !clientEmail || !privateKey) {
    console.log("Skipping live Firestore read: Admin credentials are not configured.");
    return;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  }

  const snap = await getFirestore().collection("about/pricing/plans").get();
  const live = sortPricingPlans(snap.docs.map((doc) => mapPricingPlan(doc.id, doc.data())));
  console.log("firestore catalog", JSON.stringify(live.map(summarize), null, 2));
  if (live.map((plan) => plan.id).join(",") !== "starter,business,enterprise") {
    throw new Error(`Unexpected Firestore plan order: ${live.map((plan) => plan.id).join(",")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
