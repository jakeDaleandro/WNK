import { collection, deleteDoc, doc, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import {
  Ban,
  ClipboardCheck,
  Copy,
  DollarSign,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Store,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useProfile } from "@/auth/AuthProvider";
import { ColumnChart, SERIES } from "@/components/charts";
import { CategoryArt, Countdown } from "@/components/PlateCard";
import { Badge, Button, Card, CardHeader, EmptyState, IconButton, PageHeader, Segmented, Skeleton, StatTile, cn } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { db } from "@/lib/firebase";
import { discountPct, formatDateTime, money, num, toDate } from "@/lib/format";
import { useCollection, useNow } from "@/lib/hooks";
import type { Order, Plate } from "@/lib/types";
import { PlateForm, type PlateDraftSource } from "./PlateForm";

function Menu({ items }: { items: { label: string; icon: typeof Pencil; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <IconButton icon={MoreHorizontal} label="Listing actions" onClick={() => setOpen(!open)} />
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 animate-pop rounded-xl bg-white p-1 shadow-lift ring-1 ring-stone-900/10">
          {items.map((i) => (
            <button
              key={i.label}
              onClick={() => {
                setOpen(false);
                i.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                i.danger ? "text-red-600 hover:bg-red-50" : "text-stone-700 hover:bg-stone-50",
              )}
            >
              <i.icon className="size-4" /> {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ListingRow({ plate, now, onEdit, onRelist }: { plate: Plate; now: number; onEdit: () => void; onRelist: () => void }) {
  const live = plate.status === "active" && (toDate(plate.expiresAt)?.getTime() ?? 0) > now;
  const sold = plate.reserved;
  const pctSold = Math.round((sold / plate.quantity) * 100);
  const off = discountPct(plate.price, plate.originalPrice);

  async function withdraw() {
    try {
      await updateDoc(doc(db, "plates", plate.id), { status: "withdrawn", updatedAt: serverTimestamp() });
      toast.success("Listing withdrawn. Existing reservations are still honored.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  async function remove() {
    try {
      await deleteDoc(doc(db, "plates", plate.id));
      toast.success("Listing deleted.");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <li className="flex items-center gap-4 px-5 py-4 sm:px-6">
      <CategoryArt category={plate.category} className="hidden size-14 shrink-0 rounded-xl sm:flex" size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-stone-900">{plate.title}</p>
          {live ? (
            <Countdown expiresAt={plate.expiresAt} now={now} />
          ) : (
            <Badge tone={plate.status === "withdrawn" ? "gray" : "red"}>{plate.status === "withdrawn" ? "Withdrawn" : "Closed"}</Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-stone-500">
          {money(plate.price)}
          {off > 0 && <span className="text-stone-400"> · {off}% off</span>} · Pick up by {formatDateTime(plate.expiresAt)}
        </p>
      </div>
      <div className="hidden w-44 md:block">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-stone-500">{num(sold)} of {num(plate.quantity)} sold</span>
          <span className="font-medium text-stone-700">{pctSold}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-stone-100">
          <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pctSold}%` }} />
        </div>
      </div>
      <Menu
        items={[
          ...(live ? [{ label: "Edit", icon: Pencil, onClick: onEdit }] : []),
          { label: "List again", icon: Copy, onClick: onRelist },
          ...(live ? [{ label: "Withdraw", icon: Ban, onClick: withdraw, danger: true }] : []),
          ...(sold === 0 ? [{ label: "Delete", icon: Trash2, onClick: remove, danger: true }] : []),
        ]}
      />
    </li>
  );
}

export default function Listings() {
  const profile = useProfile();
  const now = useNow();
  const [tab, setTab] = useState<"live" | "past">("live");
  const [form, setForm] = useState<PlateDraftSource | null | undefined>(undefined);

  const { data: plates, loading } = useCollection<Plate>(
    query(collection(db, "plates"), where("restaurantId", "==", profile.id), orderBy("createdAt", "desc")),
    `plates-${profile.id}`,
  );
  const { data: orders } = useCollection<Order>(
    query(collection(db, "orders"), where("restaurantId", "==", profile.id), orderBy("createdAt", "desc")),
    `rest-orders-${profile.id}`,
  );

  const isLive = (p: Plate) => p.status === "active" && (toDate(p.expiresAt)?.getTime() ?? 0) > now;
  const live = plates.filter(isLive);
  const past = plates.filter((p) => !isLive(p));

  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelled");
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      available: live.reduce((s, p) => s + p.quantity - p.reserved, 0),
      awaiting: orders.filter((o) => o.status === "reserved").length,
      month: valid.filter((o) => (toDate(o.createdAt) ?? new Date()) >= monthStart).reduce((s, o) => s + o.total, 0),
      rescued: valid.reduce((s, o) => s + o.quantity, 0),
    };
  }, [orders, live]);

  const chart = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return d;
    });
    return days.map((d) => {
      const next = d.getTime() + 86_400_000;
      const day = orders.filter((o) => {
        const t = toDate(o.createdAt)?.getTime() ?? Date.now();
        return o.status !== "cancelled" && t >= d.getTime() && t < next;
      });
      return {
        day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        purchased: day.filter((o) => o.type === "purchase").reduce((s, o) => s + o.quantity, 0),
        donated: day.filter((o) => o.type === "donation").reduce((s, o) => s + o.quantity, 0),
      };
    });
  }, [orders]);

  const relist = (p: Plate) =>
    setForm({ title: p.title, description: p.description, category: p.category, dietary: p.dietary, price: p.price, originalPrice: p.originalPrice, quantity: p.quantity });

  const shown = tab === "live" ? live : past;

  return (
    <>
      <PageHeader
        eyebrow={profile.name}
        title="Listings"
        description="Post surplus food, track what's selling, and keep an eye on your pickup window."
        actions={
          <>
            <Button variant="secondary" to="/app/restaurant/pickups" icon={ClipboardCheck}>
              Verify pickups{stats.awaiting ? ` (${stats.awaiting})` : ""}
            </Button>
            <Button icon={Plus} onClick={() => setForm(null)}>New listing</Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Live listings" value={num(live.length)} icon={Store} sub={`${num(stats.available)} portions available`} />
        <StatTile label="Awaiting pickup" value={num(stats.awaiting)} icon={Package} tone="accent" sub="Customer reservations" />
        <StatTile label="Revenue this month" value={money(stats.month)} icon={DollarSign} tone="sky" />
        <StatTile label="Meals rescued" value={num(stats.rescued)} icon={UtensilsCrossed} tone="violet" sub="All time" />
      </div>

      <Card className="mb-6">
        <CardHeader
          title="Portions rescued"
          description="Last 14 days"
          action={
            <div className="flex gap-4 text-xs text-stone-600">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: SERIES[0] }} />Purchased</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: SERIES[1] }} />Donated</span>
            </div>
          }
        />
        <div className="px-3 pt-4 pb-4 sm:px-5">
          <ColumnChart
            data={chart}
            xKey="day"
            height={220}
            series={[
              { key: "purchased", name: "Purchased", color: SERIES[0] },
              { key: "donated", name: "Donated", color: SERIES[1] },
            ]}
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h3 className="text-[15px] font-semibold text-stone-900">Your listings</h3>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "live", label: "Live", count: live.length },
              { value: "past", label: "Past", count: past.length },
            ]}
          />
        </div>
        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : shown.length ? (
          <ul className="mt-3 divide-y divide-stone-100">
            {shown.map((p) => (
              <ListingRow key={p.id} plate={p} now={now} onEdit={() => setForm(p)} onRelist={() => relist(p)} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Store}
            title={tab === "live" ? "Nothing live right now" : "No past listings"}
            description={tab === "live" ? "Have extra food tonight? A listing takes about 20 seconds." : undefined}
            action={tab === "live" && <Button icon={Plus} onClick={() => setForm(null)}>Create a listing</Button>}
          />
        )}
      </Card>

      {form !== undefined && <PlateForm source={form} onClose={() => setForm(undefined)} />}
    </>
  );
}
