import { ConfigNotice } from "@/components/ui/states";

export function AuthCard({
  title,
  description,
  children,
  footer,
  configured = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  configured?: boolean;
}) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {!configured && (
        <ConfigNotice
          className="mb-5"
          title="Authentication unavailable"
          description="Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment."
        />
      )}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">{children}</div>
      {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
