"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";
import type { AppNotification } from "@/types";

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const payload = await apiFetch<{ notifications: AppNotification[] }>("/api/notifications");
    setItems(payload.notifications);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Notifications</h1>
        <Button variant="secondary" onClick={() => apiFetch("/api/notifications/read-all", { method: "POST" }).then(load)}>
          Mark all read
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="Deployment, billing, domain, and renewal events will appear here."
          actionHref="/dashboard"
          actionLabel="Back to overview"
        />
      ) : (
        items.map((item) => (
          <Card key={item.notificationId} className={`p-4 ${item.read ? "" : "border-accent"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.message}</p>
                <p className="mt-2 text-xs text-muted">{formatDateTime(item.createdAt)}</p>
              </div>
              {!item.read ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    apiFetch(`/api/notifications/${item.notificationId}`, {
                      method: "PATCH",
                      body: JSON.stringify({ read: true }),
                    }).then(load)
                  }
                >
                  Mark read
                </Button>
              ) : null}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
