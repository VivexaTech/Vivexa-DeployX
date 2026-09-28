"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <ErrorState
        title="We couldn't load this page"
        description={
          <>
            Please try again. If the problem persists, contact support.
            {error.digest && <span className="mt-2 block font-mono text-xs text-muted-soft">Reference: {error.digest}</span>}
          </>
        }
        action={
          <Button onClick={reset} variant="outline">
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        }
      />
    </Card>
  );
}
