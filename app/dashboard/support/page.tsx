"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicContent } from "@/hooks/use-public-content";

export default function SupportPage() {
  const { support, loading } = usePublicContent();
  if (loading) return <Skeleton className="h-48" />;
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Support</h1>
      <Card className="p-6">
        {support?.email || support?.phone ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Contact support using the details configured for Vivexa Tech.</p>
            {support.email ? (
              <p>
                Email: <a href={`mailto:${support.email}`}>{support.email}</a>
              </p>
            ) : null}
            {support.phone ? (
              <p>
                Phone: <a href={`tel:${support.phone}`}>{support.phone}</a>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">Support contact details have not been published in Firestore yet.</p>
        )}
      </Card>
    </div>
  );
}
