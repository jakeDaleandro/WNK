import { Compass } from "lucide-react";
import { Button, Logo } from "@/components/ui";

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-16" />
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Compass className="size-7" />
      </span>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">This page wandered off</h1>
      <p className="mt-3 max-w-md text-stone-500">The page you're looking for doesn't exist or has moved.</p>
      <Button to="/" className="mt-8">
        Back home
      </Button>
    </div>
  );
}
