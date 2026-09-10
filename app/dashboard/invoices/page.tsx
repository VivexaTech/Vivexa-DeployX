"use client";

import { useEffect, useState } from "react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice } from "@/types";

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ invoices: Invoice[] }>("/api/invoices")
      .then((payload) => setInvoices(payload.invoices))
      .finally(() => setLoading(false));
  }, []);

  async function download(invoiceId: string, invoiceNumber: string) {
    const token = await user?.getIdToken();
    const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Invoices</h1>
      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices appear after Razorpay verifies a successful payment or subscription charge."
          actionHref="/dashboard/billing"
          actionLabel="View billing"
        />
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card key={invoice.invoiceId} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <p className="text-sm text-muted">
                  {invoice.planName} · {formatDate(invoice.paymentDate)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold">{formatCurrency(invoice.amount, invoice.currency)}</p>
                <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>
                <Button size="sm" onClick={() => void download(invoice.invoiceId, invoice.invoiceNumber)}>
                  Download
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
