"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <ErrorState
        title="Something went wrong"
        description={
          <>
            An unexpected error occurred. Please try again.
            {error.digest && <span className="mt-2 block font-mono text-xs text-muted-soft">Reference: {error.digest}</span>}
          </>
        }
        action={
          <div className="flex gap-2">
            <Button onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
            <ButtonLink href="/" variant="outline">
              Home
            </ButtonLink>
          </div>
        }
      />
    </main>
  );
}
