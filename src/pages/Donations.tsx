import { collection, orderBy, query, where } from "firebase/firestore";
import { Download, HandHeart, Heart, Soup, Store, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useProfile } from "@/auth/AuthProvider";
import { ColumnChart, ProportionBar, SERIES } from "@/components/charts";
import { Button, Card, CardHeader, EmptyState, PageHeader, Select, Skeleton, StatTile } from "@/components/ui";
import { db } from "@/lib/firebase";
import { formatDate, money, num, toDate } from "@/lib/format";
import { useCollection } from "@/lib/hooks";
import type { Meal, Order } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Donations() {
  const profile = useProfile();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [exporting, setExporting] = useState(false);

  const { data: orders, loading } = useCollection<Order>(
    query(collection(db, "orders"), where("userId", "==", profile.id), orderBy("createdAt", "desc")),
    `donations-${profile.id}`,
  );
  const { data: meals } = useCollection<Meal>(
    query(collection(db, "meals"), where("donorId", "==", profile.id), orderBy("createdAt", "desc")),
    `donor-meals-${profile.id}`,
  );

  const donations = orders.filter((o) => o.type === "donation" && o.status !== "cancelled");
  const years = useMemo(() => {
    const ys = new Set([thisYear, ...donations.map((o) => toDate(o.createdAt)?.getFullYear() ?? thisYear)]);
    return [...ys].sort((a, b) => b - a);
  }, [donations, thisYear]);

  const inYear = donations.filter((o) => toDate(o.createdAt)?.getFullYear() === year);
  const mealsInYear = meals.filter((m) => toDate(m.createdAt)?.getFullYear() === year);
  const total = inYear.reduce((s, o) => s + o.total, 0);
  const mealCount = inYear.reduce((s, o) => s + o.quantity, 0);
  const delivered = mealsInYear.filter((m) => m.status === "picked_up").length;

  const monthly = MONTHS.map((m, i) => ({
    month: m,
    amount: inYear.filter((o) => toDate(o.createdAt)?.getMonth() === i).reduce((s, o) => s + o.total, 0),
  }));

  async function downloadReceipt() {
    setExporting(true);
    try {
      const { donorReceipt, fileName } = await import("@/reports/builders");
      donorReceipt({ donor: profile, year, orders: inYear, meals: mealsInYear }).save(fileName("tax-receipt", profile.name, String(year)));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Impact"
        title="Your giving, in meals"
        description="Track every meal you've donated from purchase to pickup, and download your year-end receipt."
        actions={
          <>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year" className="w-28">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Button variant="secondary" icon={Download} loading={exporting} onClick={downloadReceipt}>
              {year} tax receipt
            </Button>
            <Button to="/app/marketplace" variant="accent" icon={HandHeart}>Donate meals</Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={`Contributed in ${year}`} value={money(total)} icon={Heart} tone="accent" />
        <StatTile label="Meals donated" value={num(mealCount)} icon={Soup} />
        <StatTile label="Delivered to neighbors" value={num(delivered)} icon={Users} tone="sky" sub={mealCount ? `${Math.round((delivered / mealCount) * 100)}% of meals donated` : undefined} />
        <StatTile label="Restaurants supported" value={num(new Set(inYear.map((o) => o.restaurantId)).size)} icon={Store} tone="violet" />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Contributions by month" description={String(year)} />
          <div className="px-3 pt-4 pb-4 sm:px-5">
            <ColumnChart
              data={monthly}
              xKey="month"
              series={[{ key: "amount", name: "Contributed", color: SERIES[1] }]}
              format={(n) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`)}
            />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Where your meals are now" description="Live status of meals you donated" />
          <div className="px-5 py-6 sm:px-6">
            {mealsInYear.length ? (
              <ProportionBar
                parts={[
                  { name: "Delivered", value: delivered, color: SERIES[2] },
                  { name: "Claimed", value: mealsInYear.filter((m) => m.status === "claimed").length, color: SERIES[0] },
                  { name: "Waiting", value: mealsInYear.filter((m) => m.status === "available").length, color: SERIES[3] },
                  { name: "Expired", value: mealsInYear.filter((m) => m.status === "expired").length, color: "#a8a29e" },
                ]}
              />
            ) : (
              <p className="text-sm text-stone-500">Meals you donate will show up here as they're claimed and picked up.</p>
            )}
            <p className="mt-6 text-xs leading-relaxed text-stone-500">
              Meals that aren't claimed before the restaurant's pickup window closes expire. They still count toward
              your contribution.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Donation history" description={`${inYear.length} donation${inYear.length === 1 ? "" : "s"} in ${year}`} />
        {loading ? (
          <div className="p-6"><Skeleton className="h-32" /></div>
        ) : inYear.length ? (
          <ul className="mt-4 divide-y divide-stone-100">
            {inYear.map((o) => {
              const done = o.mealsDelivered ?? 0;
              return (
                <li key={o.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900">
                      {o.quantity} × {o.plateTitle}
                    </p>
                    <p className="text-sm text-stone-500">
                      {o.restaurantName} · {formatDate(o.createdAt)}
                    </p>
                  </div>
                  <div className="w-full sm:w-56">
                    <div className="mb-1 flex justify-between text-xs text-stone-500">
                      <span>{done} of {o.quantity} delivered</span>
                      <span>{o.mealsClaimed ?? 0} claimed</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-100">
                      <div className="h-1.5 rounded-full" style={{ width: `${(done / o.quantity) * 100}%`, background: SERIES[2] }} />
                    </div>
                  </div>
                  <p className="w-24 font-semibold text-stone-900 tabular sm:text-right">{money(o.total)}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={HandHeart}
            title={`No donations in ${year}`}
            description="Buy a plate from the marketplace and it becomes a free meal for someone nearby."
            action={<Button to="/app/marketplace" variant="accent">Make your first donation</Button>}
          />
        )}
      </Card>
    </>
  );
}
