"use client";

import { useRef, useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

/**
 * Controlled logo URL for the invoice settings form. Uploading stores the file
 * and saves the setting immediately; the field is updated so a later form save
 * doesn't overwrite the new logo with the old value.
 */
export function CompanyLogoField({ initialUrl }: { initialUrl: string }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("logo", file);
      const res = await fetch("/api/admin/company-logo", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
      setUrl(data.url);
      toast.success("Logo updated", "New invoices will use this logo.");
    } catch (error) {
      toast.error("Logo upload failed", error instanceof Error ? error.message : undefined);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Field label="Company logo" htmlFor="company_logo_url" hint="PNG, JPEG or WebP up to 1 MB, or paste an https:// URL. Past invoices keep the logo they were issued with.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-16 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-2">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Company logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-neutral-400" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input id="company_logo_url" name="company_logo_url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" maxLength={500} />
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {url ? "Replace logo" : "Upload logo"}
            </Button>
            {url && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setUrl("")} disabled={uploading}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </Field>
  );
}
