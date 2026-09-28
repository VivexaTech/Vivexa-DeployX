#!/usr/bin/env node
// Promote an existing, registered user to super_admin using the service role.
// Usage: npm run admin:promote -- you@example.com [admin|super_admin]
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
// environment or from .env.local.
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const [email, role = "super_admin"] = process.argv.slice(2);
if (!email || !["admin", "super_admin"].includes(role)) {
  console.error("Usage: npm run admin:promote -- <email> [admin|super_admin]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase
  .from("profiles")
  .update({ role })
  .eq("email", email.toLowerCase())
  .select("id, email, role");

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}
if (!data || data.length === 0) {
  console.error(`No profile found for ${email}. Register the account first.`);
  process.exit(1);
}

await supabase.from("admin_audit_logs").insert({
  admin_id: null,
  action: "ROLE_CHANGED",
  resource_type: "profile",
  resource_id: data[0].id,
  metadata: { role, via: "cli" },
});

console.log(`✓ ${data[0].email} is now ${data[0].role}`);
