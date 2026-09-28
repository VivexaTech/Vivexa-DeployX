"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser print dialog; choosing "Save as PDF" downloads the invoice. */
export function PrintInvoiceButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Download className="h-4 w-4" /> Download PDF
    </Button>
  );
}
