import { collection, orderBy, query, Timestamp, where } from "firebase/firestore";
import { DollarSign, FileText, Heart, Soup, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { ColumnChart, Legend, ProportionBar, RankedBars, SERIES } from "@/components/charts";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Segmented, StatTile } from "@/components/ui";
import { db } from "@/lib/firebase";
import { money, num, relative, toDate } from "@/lib/format";
import { useCollection } from "@/lib/hooks";
import { orderStatus, roles } from "@/lib/meta";
import type { Meal, Order, Role, UserProfile } from "@/lib/types";

type Range = "7d" | "30d" | "90d" | "12m";
const DAY = 86_400_000;

function rangeStart(r: Range) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (r === "12m") {
    d.setDate(1);
    d.setMonth(d.getMonth() - 11);
    return d;
  }
  d.setDate(d.getDate() - ({ "7d": 6, "30d": 29, "90d": 89 }[r]));
  return d;
}

/** Day buckets up to 30 days, weeks for 90 days, months for 12 months. */
function bucketize(r: Range, from: Date) {
  if (r === "12m") {
    return Array.from({ length: 12 }, (_, i) => {
      const s = new Date(from.getFullYear(), from.getMonth() + i, 1);
      const e = new Date(from.getFullYear(), from.getMonth() + i + 1, 1);
      return { label: s.toLocaleDateString("en-US", { month: "short" }), start: s.getTime(), end: e.getTime() };
    });
  }
  const step = r === "90d" ? 7 : 1;
  const n = r === "7d" ? 7 : r === "30d" ? 30 : 13;
  return Array.from({ length: n }, (_, i) => {
    const s = new Date(from.getTime() + i * step * DAY);
    return { label: s.toLocaleDateString("en-US", { month: "short", day: "numeric" }), start: s.getTime(), end: s.getTime() + step * DAY };
  });
}

export default function Overview() {
  const [range, setRange] = useState<Range>("30d");
  const from = useMemo(() => rangeStart(range), [range]);

  const { data: orders } = useCollection<Order>(
    query(collection(db, "orders"), where("createdAt", ">=", Timestamp.fromDate(from)), orderBy("createdAt", "desc")),
    `admin-orders-${range}`,
  );
  const { data: meals } = useCollection<Meal>(
    query(collection(db, "meals"), where("createdAt", ">=", Timestamp.fromDate(from)), orderBy("createdAt", "desc")),
    `admin-meals-${range}`,
  );
  const { data: users } = useCollection<UserProfile>(query(collection(db, "users")), "admin-users");

  const m = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelled");
    const purchases = valid.filter((o) => o.type === "purchase");
    const donations = valid.filter((o) => o.type === "donation");
    const newUsers = users.filter((u) => (toDate(u.createdAt)?.getTime() ?? 0) >= from.getTime());

    const buckets = bucketize(range, from).map((b) => {
      const inB = (o: Order) => {
        const t = toDate(o.createdAt)?.getTime() ?? Date.now();
        return t >= b.start && t < b.end;
      };
      return {
        label: b.label,
        purchased: purchases.filter(inB).reduce((s, o) => s + o.quantity, 0),
        donated: donations.filter(inB).reduce((s, o) => s + o.quantity, 0),
      };
    });

    const byRestaurant = new Map<string, { label: string; value: number }>();
    for (const o of valid) {
      const e = byRestaurant.get(o.restaurantId) ?? { label: o.restaurantName, value: 0 };
      e.value += o.quantity;
      byRestaurant.set(o.restaurantId, e);
    }

    return {
      rescued: valid.reduce((s, o) => s + o.quantity, 0),
      sales: purchases.reduce((s, o) => s + o.total, 0),
      donated: donations.reduce((s, o) => s + o.total, 0),
      newUsers: newUsers.length,
      buckets,
      topRestaurants: [...byRestaurant.values()].sort((a, b) => b.value - a.value).slice(0, 6),
      delivered: meals.filter((x) => x.status === "picked_up").length,
      claimed: meals.filter((x) => x.status === "claimed").length,
      waiting: meals.filter((x) => x.status === "available").length,
      expired: meals.filter((x) => x.status === "expired").length,
    };
  }, [orders, meals, users, range, from]);

  const roleCounts = (["customer", "donor", "restaurant", "needy", "admin"] as Role[]).map((r) => ({
    label: roles[r].label,
    value: users.filter((u) => u.role === r).length,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Live activity across Waste Not Kitchen."
        actions={
          <>
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: "7d", label: "7D" },
                { value: "30d", label: "30D" },
                { value: "90d", label: "90D" },
                { value: "12m", label: "12M" },
              ]}
            />
            <Button to="/app/admin/reports" variant="secondary" icon={FileText}>Reports</Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Meals rescued" value={num(m.rescued)} icon={Soup} sub={`${num(orders.length)} orders`} />
        <StatTile label="Customer sales" value={money(m.sales)} icon={DollarSign} tone="sky" />
        <StatTile label="Donations" value={money(m.donated)} icon={Heart} tone="accent" sub={`${num(m.delivered)} meals delivered`} />
        <StatTile label="New members" value={num(m.newUsers)} icon={UserPlus} tone="violet" sub={`${num(users.length)} total`} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Meals rescued"
            description={range === "12m" ? "By month" : range === "90d" ? "By week" : "By day"}
            action={
              <Legend
                items={[
                  { name: "Purchased", color: SERIES[0] },
                  { name: "Donated", color: SERIES[1] },
                ]}
              />
            }
          />
          <div className="px-3 pt-4 pb-4 sm:px-5">
            <ColumnChart
              data={m.buckets}
              xKey="label"
              height={260}
              series={[
                { key: "purchased", name: "Purchased", color: SERIES[0] },
                { key: "donated", name: "Donated", color: SERIES[1] },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Top restaurants" description="Meals rescued" />
          <div className="px-5 py-5 sm:px-6">
            {m.topRestaurants.length ? (
              <RankedBars rows={m.topRestaurants} />
            ) : (
              <p className="text-sm text-stone-500">No restaurant activity in this period.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Donated meals" description="Where meals donated in this period are now" />
          <div className="px-5 py-6 sm:px-6">
            <ProportionBar
              parts={[
                { name: "Delivered", value: m.delivered, color: SERIES[2] },
                { name: "Claimed", value: m.claimed, color: SERIES[0] },
                { name: "Waiting", value: m.waiting, color: SERIES[3] },
                { name: "Expired", value: m.expired, color: "#a8a29e" },
              ]}
            />
          </div>
          <CardHeader title="Members" description="By account type" className="border-t border-stone-100 pt-5" />
          <div className="px-5 py-5 sm:px-6">
            <RankedBars rows={roleCounts} color={SERIES[0]} />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Recent activity" action={<Button to="/app/admin/members" size="sm" variant="ghost" icon={Users}>Members</Button>} />
          {orders.length ? (
            <ul className="mt-3 divide-y divide-stone-100">
              {orders.slice(0, 9).map((o) => (
                <li key={o.id} className="flex items-center gap-4 px-5 py-3 text-sm sm:px-6">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: o.type === "donation" ? SERIES[1] : SERIES[0] }}
                    aria-hidden
                  />
                  <p className="min-w-0 flex-1 truncate text-stone-700">
                    <span className="font-medium text-stone-900">{o.userName}</span>{" "}
                    {o.type === "donation" ? "donated" : "reserved"} {o.quantity} × {o.plateTitle}{" "}
                    <span className="text-stone-400">at {o.restaurantName}</span>
                  </p>
                  <Badge tone={orderStatus[o.status].tone}>{orderStatus[o.status].label}</Badge>
                  <span className="hidden w-20 text-right font-medium tabular sm:block">{money(o.total)}</span>
                  <span className="hidden w-24 text-right text-xs text-stone-400 md:block">{relative(o.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Soup} title="No orders in this period" className="py-10" />
          )}
        </Card>
      </div>
    </>
  );
}
