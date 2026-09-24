import { collection, orderBy, query, where } from "firebase/firestore";
import { CheckCircle2, ClipboardCheck, Heart, KeyRound, ShoppingBag } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useProfile } from "@/auth/AuthProvider";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Segmented, cn } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { db } from "@/lib/firebase";
import { formatTime, relative, toDate } from "@/lib/format";
import { useCollection, useNow } from "@/lib/hooks";
import type { Meal, Order } from "@/lib/types";

interface PendingRow {
  id: string;
  kind: "purchase" | "meal";
  name: string;
  title: string;
  quantity: number;
  expiresAt: Order["expiresAt"];
  at: Order["createdAt"];
}

function CodeEntry() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ kind: string; title: string; quantity: number; name: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const res = await api.confirmPickup({ code });
      setLast(res);
      setCode("");
      toast.success(`Pickup confirmed for ${res.name}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-brand-900 to-brand-950 px-6 py-8 text-white sm:px-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white/10">
            <KeyRound className="size-5 text-brand-200" />
          </span>
          <div>
            <h2 className="font-semibold">Verify a pickup</h2>
            <p className="text-sm text-brand-200/80">Ask for the 6-character code on the guest's screen.</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            ref={input}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="K7M2QX"
            aria-label="Pickup code"
            autoComplete="off"
            spellCheck={false}
            className="h-14 flex-1 rounded-xl border-0 bg-white/10 px-5 text-center font-mono text-2xl font-semibold tracking-[0.4em] text-white uppercase ring-1 ring-white/15 placeholder:text-white/25 focus:bg-white/15 focus:ring-2 focus:ring-brand-300 focus:outline-none sm:text-left"
          />
          <Button type="submit" size="lg" variant="accent" loading={busy} disabled={code.length !== 6} className="h-14 px-8">
            Confirm pickup
          </Button>
        </form>
      </div>
      {last && (
        <div className="flex animate-fade-in items-center gap-3 bg-brand-50 px-6 py-4 sm:px-8">
          <CheckCircle2 className="size-5 shrink-0 text-brand-600" />
          <p className="text-sm text-brand-900">
            <span className="font-semibold">{last.name}</span> collected {last.quantity} × {last.title}
            {last.kind === "meal" && " (donated meal)"}.
          </p>
        </div>
      )}
    </Card>
  );
}

export default function Pickups() {
  const profile = useProfile();
  const now = useNow();
  const [tab, setTab] = useState<"pending" | "done">("pending");

  const { data: orders } = useCollection<Order>(
    query(collection(db, "orders"), where("restaurantId", "==", profile.id), orderBy("createdAt", "desc")),
    `rest-orders-${profile.id}`,
  );
  const { data: meals } = useCollection<Meal>(
    query(collection(db, "meals"), where("restaurantId", "==", profile.id), orderBy("createdAt", "desc")),
    `rest-meals-${profile.id}`,
  );

  const { pending, done } = useMemo(() => {
    const pending: PendingRow[] = [
      ...orders
        .filter((o) => o.type === "purchase" && o.status === "reserved")
        .map((o) => ({ id: o.id, kind: "purchase" as const, name: o.userName, title: o.plateTitle, quantity: o.quantity, expiresAt: o.expiresAt, at: o.createdAt })),
      ...meals
        .filter((m) => m.status === "claimed")
        .map((m) => ({ id: m.id, kind: "meal" as const, name: m.claimedByName ?? "Community member", title: m.plateTitle, quantity: 1, expiresAt: m.expiresAt, at: m.claimedAt })),
    ].sort((a, b) => (toDate(a.expiresAt)?.getTime() ?? 0) - (toDate(b.expiresAt)?.getTime() ?? 0));

    const done: PendingRow[] = [
      ...orders
        .filter((o) => o.status === "picked_up")
        .map((o) => ({ id: o.id, kind: "purchase" as const, name: o.userName, title: o.plateTitle, quantity: o.quantity, expiresAt: o.expiresAt, at: o.pickedUpAt })),
      ...meals
        .filter((m) => m.status === "picked_up")
        .map((m) => ({ id: m.id, kind: "meal" as const, name: m.claimedByName ?? "Community member", title: m.plateTitle, quantity: 1, expiresAt: m.expiresAt, at: m.pickedUpAt })),
    ]
      .sort((a, b) => (toDate(b.at)?.getTime() ?? 0) - (toDate(a.at)?.getTime() ?? 0))
      .slice(0, 30);
    return { pending, done };
  }, [orders, meals]);

  const waitingMeals = meals.filter((m) => m.status === "available" && (toDate(m.expiresAt)?.getTime() ?? 0) > now).length;
  const rows = tab === "pending" ? pending : done;

  return (
    <>
      <PageHeader
        eyebrow={profile.name}
        title="Pickups"
        description="Confirm every handoff with the guest's code. Reservations and donated meals are both verified here."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <CodeEntry />
          <Card>
            <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <h3 className="text-[15px] font-semibold text-stone-900">Handoffs</h3>
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: "pending", label: "Expected", count: pending.length },
                  { value: "done", label: "Completed", count: done.length },
                ]}
              />
            </div>
            {rows.length ? (
              <ul className="mt-3 divide-y divide-stone-100">
                {rows.map((r) => {
                  const mins = ((toDate(r.expiresAt)?.getTime() ?? 0) - now) / 60000;
                  return (
                    <li key={r.id} className="flex items-center gap-4 px-5 py-3.5 sm:px-6">
                      <span
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
                          r.kind === "meal" ? "bg-violet-50 text-violet-600" : "bg-sky-50 text-sky-600",
                        )}
                      >
                        {r.kind === "meal" ? <Heart className="size-4" /> : <ShoppingBag className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-900">
                          {r.name} <span className="font-normal text-stone-500">· {r.quantity} × {r.title}</span>
                        </p>
                        <p className="text-xs text-stone-500">
                          {r.kind === "meal" ? "Donated meal" : "Customer reservation"} ·{" "}
                          {tab === "pending" ? `claimed ${relative(r.at)}` : `picked up ${relative(r.at)}`}
                        </p>
                      </div>
                      {tab === "pending" ? (
                        <Badge tone={mins < 0 ? "red" : mins < 60 ? "amber" : "gray"}>
                          {mins < 0 ? "Past window" : `By ${formatTime(r.expiresAt).replace(/^Today, /, "")}`}
                        </Badge>
                      ) : (
                        <Badge tone="green" dot>Done</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={ClipboardCheck}
                title={tab === "pending" ? "No one's on the way" : "No completed pickups yet"}
                description={tab === "pending" ? "New reservations and claimed meals appear here instantly." : undefined}
                className="py-10"
              />
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="How verification works" />
            <ol className="space-y-4 px-5 py-5 text-sm text-stone-600 sm:px-6">
              {[
                "The guest shows a 6-character code on their phone.",
                "Enter it above. We match it to their order at your restaurant.",
                "Hand over the food. The order is marked picked up and the guest is notified in-app.",
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-5 sm:p-6">
            <p className="text-sm text-stone-500">Donated meals waiting to be claimed</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">{waitingMeals}</p>
            <p className="mt-2 text-xs text-stone-500">
              Paid for by donors. Community members can claim them until each listing's pickup window closes.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
