import { ArrowRight, Check, Clock, Croissant, Leaf, MapPin, Salad, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Logo, PickupCode } from "@/components/ui";
import { num } from "@/lib/format";
import { useDocument } from "@/lib/hooks";
import { roles } from "@/lib/meta";
import type { PublicStats, Role } from "@/lib/types";

function Nav() {
  const { user, profile } = useAuth();
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex">
          <a href="#how" className="hover:text-stone-900">How it works</a>
          <a href="#who" className="hover:text-stone-900">Who it's for</a>
          <a href="#restaurants" className="hover:text-stone-900">For restaurants</a>
        </nav>
        <div className="flex items-center gap-2">
          {user && profile ? (
            <Button to="/app" icon={ArrowRight}>
              Open dashboard
            </Button>
          ) : (
            <>
              <Button to="/login" variant="ghost" className="hidden sm:inline-flex">
                Sign in
              </Button>
              <Button to="/register">Get started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto h-[470px] w-full max-w-md select-none" aria-hidden>
      <div className="absolute inset-0 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-200/60 via-brand-100/40 to-accent-100/60 blur-2xl" />

      <div className="absolute top-4 left-2 w-[82%] rotate-[-4deg] rounded-3xl bg-white p-5 shadow-lift ring-1 ring-stone-900/5">
        <div className="flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50">
          <Croissant className="size-12 text-amber-600/80" strokeWidth={1.5} />
        </div>
        <div className="mt-4 flex items-start justify-between">
          <div>
            <p className="font-semibold text-stone-900">Morning pastry box</p>
            <p className="text-sm text-stone-500">Crumb & Co. Bakery</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-brand-800">$5.00</p>
            <p className="text-xs text-stone-400 line-through">$16.00</p>
          </div>
        </div>
      </div>

      <div className="absolute top-[13.5rem] right-0 w-[80%] rotate-[3deg] rounded-3xl bg-white p-5 shadow-lift ring-1 ring-stone-900/5">
        <div className="flex h-24 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50">
          <Salad className="size-11 text-emerald-600/80" strokeWidth={1.5} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-stone-900">Harvest grain bowl</p>
            <p className="flex items-center gap-1 text-sm text-amber-700">
              <Clock className="size-3.5" /> 1h 40m left
            </p>
          </div>
          <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-600">−65%</span>
        </div>
      </div>

      <div className="absolute bottom-0 left-6 flex items-center gap-4 rounded-2xl bg-brand-950 px-5 py-4 text-white shadow-lift">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-800">
          <Check className="size-5 text-brand-200" />
        </span>
        <div>
          <p className="text-xs text-brand-200/80">Show this at pickup</p>
          <span className="[&>span]:text-white">
            <PickupCode code="K7M2QX" />
          </span>
        </div>
      </div>
    </div>
  );
}

function ImpactBand() {
  const { data } = useDocument<PublicStats>("stats/global");
  const items = [
    { label: "Meals rescued", value: data?.mealsRescued },
    { label: "Meals donated", value: data?.mealsDonated },
    { label: "Meals delivered to neighbors", value: data?.mealsDelivered },
    { label: "Partner restaurants", value: data?.restaurants },
  ];
  return (
    <section className="border-y border-stone-200/70 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-10">
        {items.map((i) => (
          <div key={i.label} className="text-center md:text-left">
            <p className="font-display text-4xl font-semibold tracking-tight text-brand-900 tabular">{num(i.value ?? 0)}</p>
            <p className="mt-1 text-sm text-stone-500">{i.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const steps = [
  {
    icon: Leaf,
    title: "Kitchens list their surplus",
    body: "Restaurants post extra plates with a price and a pickup-by time. It takes about 20 seconds.",
  },
  {
    icon: Sparkles,
    title: "Neighbors reserve or donate",
    body: "Customers grab a deal. Donors buy meals for community members, who claim them for free.",
  },
  {
    icon: ShieldCheck,
    title: "Verified pickup",
    body: "Every order carries a one-time code the restaurant confirms at the counter. No mix-ups, no waste.",
  },
];

const roleOrder: Role[] = ["customer", "donor", "restaurant", "needy"];

export function Landing() {
  return (
    <div className="overflow-x-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative bg-gradient-to-b from-brand-50/80 via-canvas to-canvas pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-10">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-800 shadow-sm ring-1 ring-brand-900/10">
              <span className="size-1.5 rounded-full bg-brand-500" /> Fighting food waste, one plate at a time
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] font-semibold tracking-tight text-brand-950 sm:text-6xl lg:text-[4.25rem]">
              Good food deserves a <em className="text-brand-600 not-italic">second plate.</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
              Waste Not Kitchen connects local restaurants that have surplus food with people who'll enjoy it: bargain
              hunters, generous donors, and neighbors who could use a free meal.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button to="/register" size="lg" icon={ArrowRight} className="flex-row-reverse">
                Join Waste Not Kitchen
              </Button>
              <Button to="/login" size="lg" variant="secondary">
                I have an account
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-500">
              {["Free to join", "Up to 70% off menu prices", "Tax receipts for donors"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-brand-600" /> {t}
                </span>
              ))}
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <ImpactBand />

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-10 px-4 py-24 sm:px-6 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wider text-brand-600 uppercase">How it works</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-stone-900">
            From kitchen to table in three steps.
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-3xl bg-white p-7 shadow-card ring-1 ring-stone-900/5">
              <span className="absolute top-7 right-7 font-display text-5xl font-semibold text-stone-100">{i + 1}</span>
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <s.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-stone-900">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-stone-500">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section id="who" className="scroll-mt-10 bg-brand-950 py-24 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wider text-brand-300 uppercase">Who it's for</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              One platform, four ways to help.
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {roleOrder.map((r) => {
              const meta = roles[r];
              return (
                <div key={r} className="rounded-3xl bg-white/[0.04] p-7 ring-1 ring-white/10 transition hover:bg-white/[0.07]">
                  <meta.icon className="size-6 text-brand-300" />
                  <h3 className="mt-5 text-lg font-semibold">{meta.label}s</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-100/70">{meta.blurb}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Restaurants CTA */}
      <section id="restaurants" className="mx-auto max-w-7xl scroll-mt-10 px-4 py-24 sm:px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-accent-50 via-white to-brand-50 p-10 ring-1 ring-stone-900/5 sm:p-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-stone-900">
                Turn tonight's extras into revenue.
              </h2>
              <p className="mt-4 text-lg text-stone-600">
                List surplus in seconds, see reservations the moment they land, and verify every pickup with a code.
                Year-end activity statements are built in.
              </p>
              <Button to="/register" size="lg" className="mt-8" variant="accent">
                List your restaurant
              </Button>
            </div>
            <ul className="space-y-4">
              {[
                "No hardware, no contracts. Works on any device.",
                "Real-time inventory, so you never oversell.",
                "Donated meals reach neighbors in your area.",
                "Clear reporting on sales and food rescued.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-stone-700">
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-800 text-white">
                    <Check className="size-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-stone-500 sm:flex-row sm:px-6 lg:px-10">
          <Logo />
          <p className="flex items-center gap-1.5">
            <MapPin className="size-4" /> Built for local communities · © {new Date().getFullYear()} Waste Not Kitchen
          </p>
        </div>
      </footer>
    </div>
  );
}
