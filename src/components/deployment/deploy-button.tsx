"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function DeployButton({
  projectId,
  redeploy,
  disabledReason,
  size = "md",
  variant = "primary",
}: {
  projectId: string;
  redeploy?: boolean;
  disabledReason?: string | null;
  size?: "sm" | "md";
  variant?: "primary" | "outline";
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const deploy = async () => {
    if (disabledReason) {
      toast.error("Deployment unavailable", disabledReason);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = (await res.json()) as { deployment?: { id: string }; error?: string };
      if (!res.ok || !data.deployment) throw new Error(data.error ?? "Could not start deployment");
      toast.success("Deployment started", "Following build output…");
      router.push(`/dashboard/deployments/${data.deployment.id}`);
    } catch (error) {
      toast.error("Deployment failed to start", error instanceof Error ? error.message : undefined);
      setLoading(false);
    }
  };

  return (
    <Button onClick={deploy} loading={loading} size={size} variant={variant} title={disabledReason ?? undefined}>
      {!loading && (redeploy ? <RefreshCw className="h-4 w-4" /> : <Rocket className="h-4 w-4" />)}
      {redeploy ? "Redeploy" : "Deploy"}
    </Button>
  );
}
