"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Alert, ConfigNotice, EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import type { DnsRecord, Domain } from "@/types/database";

export type DomainWithProject = Domain & { project: { id: string; name: string } | null };
type ProjectOption = { id: string; name: string; deployed: boolean };

export function DomainsManager({
  domains: initial,
  projects,
  subdomainBase,
  vercelConfigured,
  openAdd,
  defaultProjectId,
}: {
  domains: DomainWithProject[];
  projects: ProjectOption[];
  subdomainBase: string;
  vercelConfigured: boolean;
  openAdd: boolean;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [domains, setDomains] = useState(initial);
  const [adding, setAdding] = useState(openAdd && vercelConfigured);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DomainWithProject | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async (domain: DomainWithProject) => {
    setVerifying(domain.id);
    try {
      const res = await fetch(`/api/domains/${domain.id}/verify`, { method: "POST" });
      const data = (await res.json()) as { domain?: Domain; error?: string };
      if (!res.ok || !data.domain) throw new Error(data.error ?? "Verification failed");
      const updated = data.domain;
      setDomains((list) => list.map((d) => (d.id === domain.id ? { ...d, ...updated } : d)));
      if (updated.status === "verified") toast.success("Domain verified", `${domain.name} is now active.`);
      else toast.error("Not verified yet", "DNS changes can take up to 48 hours to propagate. Check your records and try again.");
    } catch (error) {
      toast.error("Could not verify domain", error instanceof Error ? error.message : undefined);
    } finally {
      setVerifying(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/domains/${deleting.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove domain");
      setDomains((list) => list.filter((d) => d.id !== deleting.id));
      toast.success("Domain removed");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error("Could not remove domain", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {!vercelConfigured && (
        <ConfigNotice
          title="Domain management unavailable"
          description="Domain infrastructure is not configured. Configure platform deployment credentials to add and verify domains."
        />
      )}
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} disabled={!vercelConfigured}>
          <Plus className="h-4 w-4" /> Add Domain
        </Button>
      </div>

      {domains.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Globe className="h-5 w-5" />}
            title="No domains yet"
            description={`Add a free ${subdomainBase} subdomain or connect a domain you own.`}
          />
        </Card>
      ) : (
        domains.map((domain) => (
          <Card key={domain.id} id={domain.id} className="scroll-mt-24 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://${domain.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 truncate text-sm font-semibold text-foreground hover:underline"
                  >
                    {domain.name} <ExternalLink className="h-3.5 w-3.5 text-muted" />
                  </a>
                  <StatusBadge status={domain.status} />
                  <Badge tone="neutral">{domain.type === "subdomain" ? "DeployX subdomain" : "Custom"}</Badge>
                  {domain.ssl_status === "active" && (
                    <Badge tone="success">
                      <ShieldCheck className="h-3 w-3" /> SSL
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {domain.project?.name ?? "Unknown project"} · Last checked {timeAgo(domain.last_checked_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {domain.status !== "verified" && (
                  <Button size="sm" variant="outline" onClick={() => verify(domain)} loading={verifying === domain.id} disabled={!vercelConfigured}>
                    {verifying !== domain.id && <RefreshCw className="h-3.5 w-3.5" />} Verify Domain
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setDeleting(domain)} aria-label={`Remove ${domain.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {domain.status !== "verified" && <DnsInstructions domain={domain} />}
          </Card>
        ))
      )}

      <AddDomainDialog
        open={adding}
        onClose={() => setAdding(false)}
        projects={projects}
        subdomainBase={subdomainBase}
        defaultProjectId={defaultProjectId}
        onAdded={(domain) => {
          setDomains((list) => [domain, ...list]);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Remove domain"
        description={deleting ? `${deleting.name} will stop serving this project.` : undefined}
        confirmLabel="Remove"
      />
    </div>
  );
}

function DnsInstructions({ domain }: { domain: Domain }) {
  const records: DnsRecord[] = [...(domain.verification ?? []), ...(domain.dns_records ?? [])];
  if (domain.type === "subdomain" && records.length === 0) {
    return <p className="px-5 py-4 text-[13px] text-muted">DeployX subdomains are configured automatically. Click Verify Domain to refresh the status.</p>;
  }
  if (records.length === 0) {
    return (
      <p className="px-5 py-4 text-[13px] text-muted">
        The infrastructure provider has not returned DNS instructions yet. Click Verify Domain to refresh.
      </p>
    );
  }
  return (
    <div className="px-5 py-4">
      <p className="mb-3 text-[13px] text-muted">Add the following records at your DNS provider, then click Verify Domain.</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-background-subtle text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.map((r, i) => (
              <tr key={`${r.type}-${r.name}-${i}`}>
                <td className="px-3 py-2 font-mono text-xs">{r.type}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  <span className="inline-flex items-center gap-1">
                    {r.name}
                    <CopyButton value={r.name} label="Copy name" />
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs break-all">
                  <span className="inline-flex items-center gap-1">
                    {r.value}
                    <CopyButton value={r.value} label="Copy value" />
                  </span>
                  {r.reason && <p className="mt-0.5 font-sans text-[11px] text-muted-soft">{r.reason}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-soft">DNS changes can take up to 48 hours to propagate.</p>
    </div>
  );
}

function AddDomainDialog({
  open,
  onClose,
  projects,
  subdomainBase,
  defaultProjectId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  subdomainBase: string;
  defaultProjectId?: string;
  onAdded: (domain: DomainWithProject) => void;
}) {
  const toast = useToast();
  const [type, setType] = useState<"subdomain" | "custom">("subdomain");
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects.find((p) => p.deployed)?.id ?? projects[0]?.id ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selected = projects.find((p) => p.id === projectId);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, projectId, name: name.trim() }),
      });
      const data = (await res.json()) as { domain?: Domain; error?: string };
      if (!res.ok || !data.domain) throw new Error(data.error ?? "Could not add domain");
      onAdded({ ...data.domain, project: selected ? { id: selected.id, name: selected.name } : null });
      toast.success("Domain added", data.domain.status === "verified" ? "The domain is active." : "Configure DNS and verify the domain.");
      setName("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add domain");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add domain"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!projectId || !name.trim()}>
            Add Domain
          </Button>
        </>
      }
    >
      {projects.length === 0 ? (
        <p className="text-[13px] text-muted">Create and deploy a project before adding domains.</p>
      ) : (
        <div className="space-y-4">
          <Tabs
            value={type}
            onChange={setType}
            options={[
              { value: "subdomain", label: "DeployX subdomain" },
              { value: "custom", label: "Custom domain" },
            ]}
          />
          <Field label="Project" htmlFor="domain-project">
            <Select id="domain-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.deployed ? "" : " (not deployed)"}
                </option>
              ))}
            </Select>
          </Field>
          {type === "subdomain" ? (
            <Field label="Subdomain" htmlFor="domain-name" hint="Lowercase letters, numbers and hyphens.">
              <div className="flex items-center rounded-lg border border-border focus-within:border-accent">
                <Input
                  id="domain-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase())}
                  placeholder="myproject"
                  className="border-0 focus:ring-0"
                />
                <span className="shrink-0 pr-3 font-mono text-xs text-muted">.{subdomainBase}</span>
              </div>
            </Field>
          ) : (
            <Field label="Domain" htmlFor="domain-name" hint="e.g. example.com or www.example.com">
              <Input id="domain-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="example.com" />
            </Field>
          )}
          {selected && !selected.deployed && <Alert tone="warning">Deploy this project at least once before adding domains.</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
    </Dialog>
  );
}
