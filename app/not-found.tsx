import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <Logo />
        <h1 className="mt-6 text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">That route does not exist in Vivexa DeployX.</p>
        <Link href="/" className="mt-6 inline-flex">
          <Button>Back home</Button>
        </Link>
      </div>
    </div>
  );
}
