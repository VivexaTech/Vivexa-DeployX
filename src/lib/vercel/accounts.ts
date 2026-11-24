import "server-only";
import { integrations, serverConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/utils/crypto";
import { PublicError } from "@/lib/utils/sanitize";
import { VERCEL_NOT_CONFIGURED } from "@/lib/vercel/client";
import type { VercelAccount } from "@/types/database";

export type VercelCredentials = {
  token: string;
  teamId?: string | null;
  accountId?: string | null;
  accountName?: string | null;
};

type AccountRow = {
  id: string;
  name: string;
  token_encrypted: string;
  team_id: string | null;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function accountToCredentials(row: AccountRow): VercelCredentials {
  try {
    const token = decryptSecret(row.token_encrypted);
    return {
      token,
      teamId: row.team_id || null,
      accountId: row.id,
      accountName: row.name,
    };
  } catch (err) {
    console.error(`[vercel accounts] Failed to decrypt token for account ${row.id} (${row.name}):`, err);
    throw new PublicError("Failed to decrypt stored Vercel credentials. Please check ENCRYPTION_KEY or re-enter the account token.", 500);
  }
}

type ProjectLookup = { id: string; user_id: string; vercel_account_id?: string | null };

/**
 * Resolves the appropriate Vercel credentials with priority:
 * 1. Project-level assigned Vercel account
 * 2. User-level assigned Vercel account
 * 3. Default active platform Vercel account in database
 * 4. Any active platform Vercel account in database
 * 5. Environment variable fallback (VERCEL_TOKEN, VERCEL_TEAM_ID)
 */
export async function resolveVercelCredentials(options: {
  projectId?: string;
  userId?: string;
} = {}): Promise<VercelCredentials> {
  const admin = createAdminClient();

  // 1. Project-level lookup
  let resolvedUserId = options.userId;
  if (options.projectId) {
    let project: ProjectLookup | null = null;
    try {
      const res = await admin
        .from("projects")
        .select("id, user_id, vercel_account_id")
        .eq("id", options.projectId)
        .maybeSingle();

      if (!res.error && res.data) {
        project = res.data as unknown as ProjectLookup;
      } else {
        const fallback = await admin
          .from("projects")
          .select("id, user_id")
          .eq("id", options.projectId)
          .maybeSingle();
        if (fallback.data) {
          project = fallback.data as unknown as ProjectLookup;
        }
      }
    } catch {
      // ignore
    }

    if (project) {
      const p: ProjectLookup = project;
      if (!resolvedUserId) resolvedUserId = p.user_id;

      if (p.vercel_account_id) {
        try {
          const { data: account, error: accErr } = await admin
            .from("vercel_accounts")
            .select("*")
            .eq("id", p.vercel_account_id)
            .eq("is_active", true)
            .maybeSingle();

          if (!accErr && account) {
            return accountToCredentials(account as AccountRow);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // 2. User-level lookup
  if (resolvedUserId) {
    try {
      const { data: profile, error: profErr } = await admin
        .from("profiles")
        .select("id, vercel_account_id")
        .eq("id", resolvedUserId)
        .maybeSingle();

      if (!profErr && profile?.vercel_account_id) {
        const { data: account, error: accErr } = await admin
          .from("vercel_accounts")
          .select("*")
          .eq("id", profile.vercel_account_id)
          .eq("is_active", true)
          .maybeSingle();

        if (!accErr && account) {
          return accountToCredentials(account as AccountRow);
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Platform default active account
  try {
    const { data: defaultAccount, error: defErr } = await admin
      .from("vercel_accounts")
      .select("*")
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();

    if (!defErr && defaultAccount) {
      return accountToCredentials(defaultAccount as AccountRow);
    }
  } catch {
    // ignore
  }

  // 4. Any active account in database
  try {
    const { data: anyAccount, error: anyErr } = await admin
      .from("vercel_accounts")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!anyErr && anyAccount) {
      return accountToCredentials(anyAccount as AccountRow);
    }
  } catch {
    // ignore
  }

  // 5. Global Environment fallback
  if (process.env.VERCEL_TOKEN && process.env.VERCEL_TOKEN.trim()) {
    return {
      token: process.env.VERCEL_TOKEN.trim(),
      teamId: serverConfig.vercelTeamId() || null,
      accountName: "Environment Default",
    };
  }

  throw new PublicError(VERCEL_NOT_CONFIGURED, 503);
}

/** Check if Vercel is configured either in database or via environment. */
export async function hasActiveVercelAccount(): Promise<boolean> {
  if (integrations.vercel()) return true;
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from("vercel_accounts")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export type VercelConnectionTestResult = {
  valid: boolean;
  user?: { id: string; username: string; email: string };
  team?: { id: string; name: string; slug: string };
  error?: string;
};

/**
 * Validates a Vercel token and optional team ID against the official Vercel API.
 */
export async function testVercelConnection(
  token: string,
  teamId?: string | null,
): Promise<VercelConnectionTestResult> {
  if (!token || !token.trim()) {
    return { valid: false, error: "Vercel API token is required" };
  }

  try {
    // 1. Verify user token
    const userRes = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${token.trim()}` },
      cache: "no-store",
    });

    if (!userRes.ok) {
      if (userRes.status === 401 || userRes.status === 403) {
        return { valid: false, error: "Invalid or expired Vercel API token." };
      }
      return { valid: false, error: `Vercel returned HTTP ${userRes.status}` };
    }

    const userData = (await userRes.json()) as { user: { id: string; username: string; email: string } };

    // 2. If teamId is specified, verify access to that team
    let teamInfo: { id: string; name: string; slug: string } | undefined;
    const trimmedTeam = teamId?.trim();
    if (trimmedTeam) {
      const teamRes = await fetch(`https://api.vercel.com/v2/teams/${encodeURIComponent(trimmedTeam)}`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
        cache: "no-store",
      });

      if (!teamRes.ok) {
        return {
          valid: false,
          user: userData.user,
          error: `Token is valid for user ${userData.user.username}, but Team "${trimmedTeam}" was not found or access was denied.`,
        };
      }

      const teamData = (await teamRes.json()) as { id: string; name: string; slug: string };
      teamInfo = { id: teamData.id, name: teamData.name, slug: teamData.slug };
    }

    return {
      valid: true,
      user: userData.user,
      team: teamInfo,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Failed to connect to Vercel API",
    };
  }
}
