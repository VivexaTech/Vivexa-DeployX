import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ActionButton } from "@/components/admin/action-form";
import { VercelAccountDialog } from "@/components/admin/vercel-account-dialog";
import {
  deleteVercelAccountAction,
  saveVercelAccountAction,
  setDefaultVercelAccountAction,
  testVercelAccountAction,
  toggleVercelAccountStatusAction,
} from "../actions";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import type { VercelAccount } from "@/types/database";

export const metadata: Metadata = { title: "Vercel Accounts" };

export default async function AdminVercelAccountsPage() {
  await requireAdmin();
  const db = createAdminClient();

  const [accountsRes, profilesRes, projectsRes] = await Promise.all([
    db
      .from("vercel_accounts")
      .select("id, name, team_id, is_default, is_active, notes, created_at, updated_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    db.from("profiles").select("vercel_account_id").not("vercel_account_id", "is", null),
    db.from("projects").select("vercel_account_id").not("vercel_account_id", "is", null),
  ]);

  const accounts = (accountsRes.data as VercelAccount[]) ?? [];
  const userAccounts = (profilesRes.data as { vercel_account_id: string }[]) ?? [];
  const projectAccounts = (projectsRes.data as { vercel_account_id: string }[]) ?? [];

  const usersCountMap = new Map<string, number>();
  for (const row of userAccounts) {
    if (row.vercel_account_id) {
      usersCountMap.set(row.vercel_account_id, (usersCountMap.get(row.vercel_account_id) ?? 0) + 1);
    }
  }

  const projectsCountMap = new Map<string, number>();
  for (const row of projectAccounts) {
    if (row.vercel_account_id) {
      projectsCountMap.set(row.vercel_account_id, (projectsCountMap.get(row.vercel_account_id) ?? 0) + 1);
    }
  }

  const defaultAccount = accounts.find((a) => a.is_default);

  return (
    <>
      <PageHeader
        title="Vercel Accounts & Teams"
        description="Configure multiple Vercel accounts and teams. Assign dedicated accounts per user or project to prevent reaching account limits."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Vercel Accounts" }]}
        actions={
          <VercelAccountDialog
            saveAction={saveVercelAccountAction}
            testAction={testVercelAccountAction}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader title="Configured accounts" />
          <CardContent>
            <p className="text-2xl font-bold">{accounts.length}</p>
            <p className="text-xs text-muted">
              {accounts.filter((a) => a.is_active).length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Default platform fallback" />
          <CardContent>
            <p className="truncate text-lg font-semibold text-foreground">
              {defaultAccount ? defaultAccount.name : "Environment (VERCEL_TOKEN)"}
            </p>
            <p className="text-xs text-muted">
              {defaultAccount?.team_id ? `Team: ${defaultAccount.team_id}` : "Personal / Global env"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Assigned projects" />
          <CardContent>
            <p className="text-2xl font-bold">{projectAccounts.length}</p>
            <p className="text-xs text-muted">
              Across {userAccounts.length} dedicated users
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        {accounts.length === 0 ? (
          <EmptyState
            title="No Vercel accounts configured yet"
            description="All deployments are currently using the server's global VERCEL_TOKEN. Add your first dedicated account above to start distributing users and preventing account resource limits."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Account Name</TH>
                <TH>Team ID</TH>
                <TH>Status</TH>
                <TH>Assigned</TH>
                <TH>Created</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {accounts.map((acc) => {
                const userCount = usersCountMap.get(acc.id) ?? 0;
                const projectCount = projectsCountMap.get(acc.id) ?? 0;
                return (
                  <TR key={acc.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{acc.name}</span>
                        {acc.is_default && <Badge tone="accent">Default</Badge>}
                      </div>
                      {acc.notes && <p className="text-xs text-muted truncate max-w-xs">{acc.notes}</p>}
                    </TD>
                    <TD>
                      {acc.team_id ? (
                        <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono">{acc.team_id}</code>
                      ) : (
                        <span className="text-xs text-muted">Personal account</span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge status={acc.is_active ? "ready" : "cancelled"} />
                    </TD>
                    <TD className="text-xs text-muted">
                      <span>{userCount} user(s)</span> · <span>{projectCount} project(s)</span>
                    </TD>
                    <TD className="text-xs text-muted">{formatDate(acc.created_at)}</TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionButton
                          action={testVercelAccountAction}
                          fields={{ id: acc.id }}
                          variant="ghost"
                          size="sm"
                        >
                          Test
                        </ActionButton>

                        {!acc.is_default && (
                          <ActionButton
                            action={setDefaultVercelAccountAction}
                            fields={{ id: acc.id }}
                            variant="ghost"
                            size="sm"
                          >
                            Set Default
                          </ActionButton>
                        )}

                        <ActionButton
                          action={toggleVercelAccountStatusAction}
                          fields={{ id: acc.id, isActive: acc.is_active ? "false" : "true" }}
                          variant="ghost"
                          size="sm"
                        >
                          {acc.is_active ? "Deactivate" : "Activate"}
                        </ActionButton>

                        <VercelAccountDialog
                          saveAction={saveVercelAccountAction}
                          testAction={testVercelAccountAction}
                          account={acc}
                        />

                        <ActionButton
                          action={deleteVercelAccountAction}
                          fields={{ id: acc.id }}
                          variant="danger"
                          size="sm"
                          confirm={{
                            title: `Delete Vercel account "${acc.name}"?`,
                            description: "Any users or projects assigned to this account will revert to the platform default account. Existing provider projects on Vercel are not deleted.",
                            confirmLabel: "Delete account",
                            danger: true,
                          }}
                        >
                          Delete
                        </ActionButton>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
