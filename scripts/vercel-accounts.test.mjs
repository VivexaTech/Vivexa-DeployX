// Run with: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/vercel-accounts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const rawKey = Buffer.alloc(32, "a").toString("base64");
const key = Buffer.from(rawKey, "base64");

function encryptSecret(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptSecret(payload) {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported encrypted payload");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

test("Vercel token encryption and decryption with AES-256-GCM", () => {
  const rawToken = "vercel_tok_1234567890abcdefghijklmnopqrstuvwxyz";
  const encrypted = encryptSecret(rawToken);

  assert.notEqual(encrypted, rawToken);
  assert.ok(encrypted.startsWith("v1."));

  const decrypted = decryptSecret(encrypted);
  assert.equal(decrypted, rawToken);
});

test("Vercel team query parameter formatting logic with custom credentials", () => {
  function withTeam(path, credentials) {
    const teamId = credentials && credentials.teamId !== undefined
      ? credentials.teamId
      : "team_env_default";
    if (!teamId) return path;
    return `${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}`;
  }

  // 1. Account with specific team ID
  assert.equal(
    withTeam("/v11/projects", { teamId: "team_custom_123" }),
    "/v11/projects?teamId=team_custom_123",
  );

  // 2. Personal account (teamId is null/empty)
  assert.equal(
    withTeam("/v11/projects", { teamId: null }),
    "/v11/projects",
  );

  // 3. Request with existing query parameters and team ID
  assert.equal(
    withTeam("/v13/deployments?skipAutoDetectionConfirmation=1", { teamId: "team_prod" }),
    "/v13/deployments?skipAutoDetectionConfirmation=1&teamId=team_prod",
  );

  // 4. Fallback to default when credentials.teamId is undefined
  assert.equal(
    withTeam("/v11/projects", {}),
    "/v11/projects?teamId=team_env_default",
  );
});

test("Vercel multi-account resolution precedence", () => {
  const mockDb = {
    projects: {
      "proj-dedicated": { id: "proj-dedicated", user_id: "user-1", vercel_account_id: "acc-dedicated-project" },
      "proj-user-assigned": { id: "proj-user-assigned", user_id: "user-2", vercel_account_id: null },
      "proj-default": { id: "proj-default", user_id: "user-3", vercel_account_id: null },
    },
    profiles: {
      "user-1": { id: "user-1", vercel_account_id: "acc-user-1" },
      "user-2": { id: "user-2", vercel_account_id: "acc-user-2" },
      "user-3": { id: "user-3", vercel_account_id: null },
    },
    vercel_accounts: {
      "acc-dedicated-project": { id: "acc-dedicated-project", name: "Dedicated Project Team", team_id: "team_proj" },
      "acc-user-1": { id: "acc-user-1", name: "User 1 Team", team_id: "team_u1" },
      "acc-user-2": { id: "acc-user-2", name: "User 2 Team", team_id: "team_u2" },
      "acc-default": { id: "acc-default", name: "Global Default Team", team_id: "team_default", is_default: true },
    },
  };

  function resolveAccount(projectId, userId) {
    if (projectId) {
      const proj = mockDb.projects[projectId];
      if (proj?.vercel_account_id) return mockDb.vercel_accounts[proj.vercel_account_id];
      if (proj && !userId) userId = proj.user_id;
    }
    if (userId) {
      const user = mockDb.profiles[userId];
      if (user?.vercel_account_id) return mockDb.vercel_accounts[user.vercel_account_id];
    }
    // Fallback to default active account
    return Object.values(mockDb.vercel_accounts).find((a) => a.is_default);
  }

  // 1. Project with its own assigned account takes highest precedence
  const res1 = resolveAccount("proj-dedicated");
  assert.equal(res1.id, "acc-dedicated-project");
  assert.equal(res1.team_id, "team_proj");

  // 2. Project without its own account inherits user's assigned account
  const res2 = resolveAccount("proj-user-assigned");
  assert.equal(res2.id, "acc-user-2");
  assert.equal(res2.team_id, "team_u2");

  // 3. User with no assigned account falls back to the platform default account
  const res3 = resolveAccount("proj-default");
  assert.equal(res3.id, "acc-default");
  assert.equal(res3.team_id, "team_default");
});
