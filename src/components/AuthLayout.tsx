import { Quote } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "./ui";

export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-brand-700/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 size-[420px] rounded-full bg-accent-500/15 blur-3xl" />
        <Link to="/" className="relative">
          <Logo light />
        </Link>
        <div className="relative mt-auto max-w-md">
          <Quote className="size-8 text-brand-400" />
          <p className="mt-5 font-display text-3xl leading-snug font-medium">
            About a third of the food we produce is never eaten. Every plate rescued here is one that feeds someone
            instead.
          </p>
          <p className="mt-6 text-sm text-brand-200/70">The Waste Not Kitchen mission</p>
        </div>
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-10">
        <Link to="/" className="lg:hidden">
          <Logo />
        </Link>
        <div className={`m-auto w-full py-10 ${wide ? "max-w-2xl" : "max-w-sm"} animate-fade-in`}>{children}</div>
      </main>
    </div>
  );
}
