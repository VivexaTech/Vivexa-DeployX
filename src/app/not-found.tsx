import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative">
        <Logo className="mb-10 justify-center" />
        <p className="font-mono text-sm text-muted">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">This page could not be found</h1>
        <p className="mt-3 text-sm text-muted">The page you are looking for doesn&apos;t exist or has been moved.</p>
        <div className="mt-8 flex justify-center gap-2">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/dashboard" variant="outline">
            Dashboard
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
