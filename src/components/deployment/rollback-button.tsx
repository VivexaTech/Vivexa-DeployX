"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { shortSha } from "@/lib/utils";

export function RollbackButton({
  projectId,
  deploymentId,
  commitSha,
  isCurrentProduction,
}: {
  projectId: string;
  deploymentId: string;
  commitSha?: string | null;
  isCurrentProduction?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  if (isCurrentProduction) {
    return null;
  }

  const handleRollback = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          deploymentId,
          isRollback: true,
        }),
      });
      const data = (await res.json()) as { deployment?: { id: string }; error?: string };
      if (!res.ok || !data.deployment) throw new Error(data.error ?? "Could not initiate rollback");
      toast.success("Rollback deployment initiated", "Streaming build output…");
      setOpen(false);
      router.push(`/dashboard/deployments/${data.deployment.id}`);
    } catch (err) {
      toast.error("Rollback failed", err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-background-subtle hover:text-foreground"
        title="Rollback to this commit"
      >
        <RotateCcw className="h-3 w-3" /> Rollback
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rollback to previous deployment"
        description={`This will trigger a new production deployment with the code from commit ${commitSha ? shortSha(commitSha) : deploymentId.slice(0, 7)}.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleRollback} loading={loading}>
              <RotateCcw className="h-4 w-4" /> Confirm Rollback
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-border bg-background-subtle p-3 text-xs text-muted">
          Your current production environment will remain live while this rollback builds and prepares. Once ready, it will safely become the active production deployment.
        </div>
      </Dialog>
    </>
  );
}
