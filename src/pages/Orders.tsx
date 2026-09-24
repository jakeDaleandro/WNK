import { collection, orderBy, query, where } from "firebase/firestore";
import { Clock, Download, MapPin, PiggyBank, Receipt, ShoppingBag, Sparkles, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useProfile } from "@/auth/AuthProvider";
import { CategoryArt } from "@/components/PlateCard";
import { Badge, Button, Card, CardHeader, EmptyState, Modal, PageHeader, PickupCode, Skeleton, StatTile } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { db } from "@/lib/firebase";
import { formatDate, formatTime, money, num, timeLeft, toDate } from "@/lib/format";
import { useCollection, useNow } from "@/lib/hooks";
import { orderStatus } from "@/lib/meta";
import type { Order } from "@/lib/types";

function ActiveOrder({ order, now }: { order: Order; now: number }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      await api.cancelOrder({ orderId: order.id });
      toast.success("Reservation cancelled. The food is back on the marketplace.");
      setConfirming(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <CategoryArt category={order.category} className="h-28 sm:h-auto sm:w-40" />
        <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-stone-900">{order.plateTitle}</h3>
              <span className="text-sm text-stone-500">× {order.quantity}</span>
            </div>
            <p className="text-sm text-stone-500">{order.restaurantName}</p>
            <div className="mt-3 space-y-1 text-[13px] text-stone-600">
              <p className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-stone-400" /> Pick up by {formatTime(order.expiresAt)}
                <span className="font-medium text-amber-700">· {timeLeft(order.expiresAt, now)}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-stone-400" /> {order.restaurantAddress}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:flex-col sm:items-end">
            <div className="rounded-xl bg-brand-50 px-4 py-2.5 text-center ring-1 ring-brand-200">
              <p className="text-[10px] font-semibold tracking-wider text-brand-700 uppercase">Pickup code</p>
              <PickupCode code={order.pickupCode ?? ""} />
            </div>
            <button onClick={() => setConfirming(true)} className="text-xs font-medium text-stone-500 hover:text-red-600">
              Cancel reservation
            </button>
          </div>
        </div>
      </div>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Cancel this reservation?"
        description={`${order.quantity} × ${order.plateTitle} from ${order.restaurantName}. You'll be refunded ${money(order.total)}.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
            <Button variant="danger" loading={busy} onClick={cancel}>Cancel reservation</Button>
          </>
        }
      >
        <p className="text-sm text-stone-600">The food will go back on the marketplace for someone else to rescue.</p>
      </Modal>
    </Card>
  );
}

export default function Orders() {
  const profile = useProfile();
  const now = useNow();
  const [exporting, setExporting] = useState(false);
  const { data: orders, loading } = useCollection<Order>(
    query(collection(db, "orders"), where("userId", "==", profile.id), orderBy("createdAt", "desc")),
    `orders-${profile.id}`,
  );

  const active = orders.filter((o) => o.status === "reserved" && (toDate(o.expiresAt)?.getTime() ?? 0) > now);
  const history = orders.filter((o) => !active.includes(o));
  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelled");
    return {
      meals: valid.reduce((s, o) => s + o.quantity, 0),
      spent: valid.reduce((s, o) => s + o.total, 0),
      saved: valid.reduce((s, o) => s + (o.originalPrice ? (o.originalPrice - o.unitPrice) * o.quantity : 0), 0),
    };
  }, [orders]);

  async function exportHistory() {
    setExporting(true);
    try {
      const year = new Date().getFullYear();
      const { customerHistory, fileName } = await import("@/reports/builders");
      const inYear = orders.filter((o) => toDate(o.createdAt)?.getFullYear() === year);
      customerHistory({ customer: profile, year, orders: inYear }).save(fileName("purchases", profile.name, String(year)));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Orders"
        title="My orders"
        description="Show your pickup code at the counter. The restaurant will confirm it and hand over your food."
        actions={
          <>
            <Button variant="secondary" icon={Download} loading={exporting} onClick={exportHistory} disabled={!orders.length}>
              Export {new Date().getFullYear()} history
            </Button>
            <Button to="/app/marketplace" icon={ShoppingBag}>Browse food</Button>
          </>
        }
      />

      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <StatTile label="Meals rescued" value={num(stats.meals)} icon={UtensilsCrossed} sub="Across all your orders" />
        <StatTile label="Total spent" value={money(stats.spent)} icon={Receipt} tone="sky" />
        <StatTile label="Saved vs. menu price" value={money(stats.saved)} icon={PiggyBank} tone="accent" sub="Good for you, good for the planet" />
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-stone-900">Ready for pickup</h2>
        {loading ? (
          <Skeleton className="h-36" />
        ) : active.length ? (
          <div className="space-y-4">
            {active.map((o) => <ActiveOrder key={o.id} order={o} now={now} />)}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={Sparkles}
              title="No active reservations"
              description="When you reserve food, your pickup code will appear here."
              action={<Button to="/app/marketplace" variant="secondary">Find something tasty</Button>}
            />
          </Card>
        )}
      </section>

      <Card>
        <CardHeader title="Order history" description={`${history.length} past order${history.length === 1 ? "" : "s"}`} />
        {history.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-stone-100 bg-stone-50/60 text-left text-xs font-medium text-stone-500">
                  <th className="px-6 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Item</th>
                  <th className="px-3 py-2.5 font-medium">Restaurant</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-6 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {history.map((o) => (
                  <tr key={o.id} className="hover:bg-stone-50/60">
                    <td className="px-6 py-3 whitespace-nowrap text-stone-500 tabular">{formatDate(o.createdAt)}</td>
                    <td className="px-3 py-3 font-medium text-stone-900">
                      {o.plateTitle} <span className="font-normal text-stone-400">× {o.quantity}</span>
                    </td>
                    <td className="px-3 py-3 text-stone-600">{o.restaurantName}</td>
                    <td className="px-3 py-3">
                      <Badge tone={orderStatus[o.status].tone} dot>
                        {o.status === "reserved" ? "Awaiting confirmation" : orderStatus[o.status].label}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right font-medium tabular">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Receipt} title="No past orders yet" className="py-10" />
        )}
      </Card>
    </>
  );
}
