// Run with: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/auto-deploy.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sanitizeLogLine, sanitizeProviderText } from "../src/lib/utils/sanitize.ts";

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function hmacSha256Hex(secret, message) {
  return createHmac("sha256", secret).update(message).digest("hex");
}

test("GitHub webhook signature verification logic", () => {
  const secret = "test-webhook-secret-12345";
  const body = JSON.stringify({ ref: "refs/heads/main", after: "abc1234567890" });
  const validSignature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const tamperedSignature = `sha256=${createHmac("sha256", "wrong-secret").update(body).digest("hex")}`;

  assert.equal(safeCompare(validSignature, validSignature), true);
  assert.equal(safeCompare(validSignature, tamperedSignature), false);
  assert.equal(safeCompare(validSignature, "malformed"), false);
});

test("Deterministic HMAC secret derivation for projects", () => {
  const serverKey = "master-encryption-key-for-test";
  const projectId = "proj_01J9ABCDEF1234567890";
  const secret1 = hmacSha256Hex(serverKey, projectId);
  const secret2 = hmacSha256Hex(serverKey, projectId);
  assert.equal(secret1, secret2);
  assert.equal(typeof secret1, "string");
  assert.equal(secret1.length, 64);
});

test("Sanitize provider text and branding from logs and errors", () => {
  const rawLog = "Build deployed to project-alpha.vercel.app with header x-vercel-id: 12345 via Vercel CLI";
  const sanitized = sanitizeProviderText(rawLog);

  assert.ok(!sanitized.includes("vercel.app"));
  assert.ok(!sanitized.includes("x-vercel-id"));
  assert.ok(!sanitized.includes("Vercel CLI"));
  assert.ok(sanitized.includes("deployx.vivexatech.in"));
  assert.ok(sanitized.includes("DeployX Build Engine") || sanitized.includes("DeployX CLI"));

  const sensitiveLog = "Authorization: Bearer sk_live_123456789012345 Vercel deployment ready";
  const cleaned = sanitizeLogLine(sensitiveLog);
  assert.ok(!cleaned.includes("sk_live_123456789012345"));
  assert.ok(!cleaned.includes("Vercel"));
});
