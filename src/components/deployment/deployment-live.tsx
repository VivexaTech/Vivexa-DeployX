"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { LogViewer } from "@/components/deployment/log-viewer";
import type { DeploymentStatus } from "@/types/database";

/** Log viewer that refreshes the server-rendered page once the deployment status changes. */
export function DeploymentLive({ deploymentId, initialStatus }: { deploymentId: string; initialStatus: DeploymentStatus }) {
  const router = useRouter();
  const last = useRef(initialStatus);

  const onStatusChange = useCallback(
    (status: DeploymentStatus) => {
      if (status === last.current) return;
      last.current = status;
      router.refresh();
    },
    [router],
  );

  return <LogViewer deploymentId={deploymentId} initialStatus={initialStatus} onStatusChange={onStatusChange} />;
}
