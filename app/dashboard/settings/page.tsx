"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { apiFetch } from "@/lib/api/client";
import { useDashboardData } from "@/hooks/use-dashboard-data";

export default function SettingsPage() {
  const { data, refresh } = useDashboardData();
  const { user } = useAuth();
  const { push } = useToast();
  const [name, setName] = useState(data?.user.name ?? "");

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <Card className="p-5">
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-4 grid gap-3 md:max-w-md">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name || data?.user.name || ""} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={data?.user.email ?? user?.email ?? ""} disabled />
          </div>
          {data?.user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.user.photoURL} alt="" className="h-16 w-16 rounded-full" />
          ) : null}
          <Button
            onClick={() =>
              apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) })
                .then(() => refresh())
                .then(() => push({ title: "Profile updated", tone: "success" }))
                .catch((error) => push({ title: error.message, tone: "danger" }))
            }
          >
            Save profile
          </Button>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">Account</h2>
        <p className="mt-2 text-sm text-muted">Signed in with Google. Account status follows your Firebase user.</p>
        <p className="mt-2 text-sm text-muted">UID: {data?.user.uid ?? user?.uid}</p>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">Preferences</h2>
        <div className="mt-3">
          <ThemeToggle />
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">Security</h2>
        <p className="mt-2 text-sm text-muted">
          Sessions are stored in an HTTP-only cookie. GitHub and Vercel credentials never appear in the browser.
        </p>
      </Card>
      <div className="flex gap-2">
        <Link href="/dashboard/billing">
          <Button variant="secondary">Billing</Button>
        </Link>
        <Link href="/dashboard/support">
          <Button variant="secondary">Support</Button>
        </Link>
      </div>
    </div>
  );
}
