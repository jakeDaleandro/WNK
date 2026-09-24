import { collection, orderBy, query, where } from "firebase/firestore";
import { Clock, Download, Heart, History, Info, MapPin, Soup } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useProfile } from "@/auth/AuthProvider";
import { CategoryArt, PlateCard } from "@/components/PlateCard";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, PickupCode, Skeleton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { db } from "@/lib/firebase";
import { formatDate, formatTime, timeLeft, toDate } from "@/lib/format";
import { useCollection, useNow } from "@/lib/hooks";
import type { Meal } from "@/lib/types";

const MAX_CLAIMS = 2;

function ClaimedMeal({ meal, now }: { meal: Meal; now: number }) {
  const [busy, setBusy] = useState(false);
  async function release() {
    setBusy(true);
    try {
      await api.releaseMeal({ mealId: meal.id });
      toast.success("Meal released. Someone else can claim it now.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="overflow-hidden">
      <div className="flex">
        <CategoryArt category={meal.category} className="w-24 shrink-0 sm:w-32" size="sm" />
        <div className="flex flex-1 flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-stone-900">{meal.plateTitle}</h3>
            <p className="text-sm text-stone-500">{meal.restaurantName}</p>
            <div className="mt-2.5 space-y-1 text-[13px] text-stone-600">
              <p className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-stone-400" /> By {formatTime(meal.expiresAt)}
                <span className="font-medium text-amber-700">· {timeLeft(meal.expiresAt, now)}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-stone-400" /> {meal.restaurantAddress}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 lg:flex-col lg:items-end">
            <div className="rounded-xl bg-brand-50 px-4 py-2.5 text-center ring-1 ring-brand-200">
              <p className="text-[10px] font-semibold tracking-wider text-brand-700 uppercase">Pickup code</p>
              <PickupCode code={meal.pickupCode ?? ""} />
            </div>
            <Button size="sm" variant="ghost" loading={busy} onClick={release}>
              I can't make it
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Meals() {
  const profile = useProfile();
  const now = useNow();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: available, loading } = useCollection<Meal>(
    query(collection(db, "meals"), where("status", "==", "available"), orderBy("expiresAt", "asc")),
    "meals-available",
  );
  const { data: mine } = useCollection<Meal>(
    query(collection(db, "meals"), where("claimedBy", "==", profile.id), orderBy("claimedAt", "desc")),
    `meals-mine-${profile.id}`,
  );

  const active = mine.filter((m) => m.status === "claimed");
  const past = mine.filter((m) => m.status !== "claimed");
  const atLimit = active.length >= MAX_CLAIMS;

  // Donations of several identical meals are shown once with a count.
  const groups = useMemo(() => {
    const map = new Map<string, Meal[]>();
    for (const m of available) {
      if ((toDate(m.expiresAt)?.getTime() ?? 0) <= now) continue;
      const k = `${m.plateId}`;
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    return [...map.values()];
  }, [available, now]);

  async function claim(group: Meal[]) {
    setClaiming(group[0].plateId);
    // Try each meal in the group in case someone else claims one first.
    for (const meal of group) {
      try {
        await api.claimMeal({ mealId: meal.id });
        toast.success(`Claimed! Show your code at ${meal.restaurantName}.`);
        setClaiming(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      } catch (err) {
        const msg = errorMessage(err);
        if (!msg.includes("just claimed")) {
          toast.error(msg);
          break;
        }
      }
    }
    setClaiming(null);
  }

  async function exportHistory() {
    setExporting(true);
    try {
      const year = new Date().getFullYear();
      const { communityReport, fileName } = await import("@/reports/builders");
      communityReport({ member: profile, year, meals: mine.filter((m) => toDate(m.claimedAt)?.getFullYear() === year) }).save(
        fileName("meals", profile.name, String(year)),
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Community meals"
        title={`Hi ${profile.name.split(" ")[0]}, dinner's on your neighbors`}
        description="These meals were paid for by donors in your community. Claim one, show the code at the restaurant, and enjoy. It's free."
        actions={
          <Button variant="secondary" icon={Download} loading={exporting} onClick={exportHistory} disabled={!mine.length}>
            My meal history
          </Button>
        }
      />

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Your meals</h2>
          <Badge tone={atLimit ? "amber" : "gray"}>
            {active.length} of {MAX_CLAIMS} claimed
          </Badge>
        </div>
        {active.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {active.map((m) => <ClaimedMeal key={m.id} meal={m} now={now} />)}
          </div>
        ) : (
          <Card className="flex items-center gap-4 p-5">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Info className="size-5" />
            </span>
            <p className="text-sm text-stone-600">
              You can hold up to {MAX_CLAIMS} meals at a time. Once you pick one up (or release it), you can claim another.
            </p>
          </Card>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-stone-900">Available now</h2>
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
          </div>
        ) : groups.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => {
              const m = g[0];
              return (
                <PlateCard
                  key={m.plateId}
                  {...m}
                  title={m.plateTitle}
                  now={now}
                  badge={<span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-brand-800 shadow-sm">Free</span>}
                  footer={
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-500">{g.length} available</span>
                      <Button size="sm" icon={Heart} disabled={atLimit} loading={claiming === m.plateId} onClick={() => claim(g)}>
                        {atLimit ? "Limit reached" : "Claim meal"}
                      </Button>
                    </div>
                  }
                />
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={Soup}
              title="No meals available right now"
              description="Donors add new meals throughout the day. This page updates on its own, so check back soon."
            />
          </Card>
        )}
      </section>

      {past.length > 0 && (
        <Card>
          <CardHeader title="History" description="Meals you've picked up" action={<History className="size-5 text-stone-300" />} />
          <ul className="mt-4 divide-y divide-stone-100">
            {past.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm sm:px-6">
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-900">{m.plateTitle}</p>
                  <p className="text-stone-500">{m.restaurantName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={m.status === "picked_up" ? "green" : "gray"} dot>
                    {m.status === "picked_up" ? "Picked up" : "Expired"}
                  </Badge>
                  <p className="mt-1 text-xs text-stone-400">{formatDate(m.pickedUpAt ?? m.claimedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
