import { collection, orderBy, query, Timestamp, where } from "firebase/firestore";
import { CheckCircle2, HandHeart, Heart, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useProfile } from "@/auth/AuthProvider";
import { CategoryArt, DietaryTags, PlateCard } from "@/components/PlateCard";
import { Button, Chip, EmptyState, Input, Modal, PageHeader, PickupCode, Select, Skeleton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { brandLabel } from "@/lib/card";
import { db } from "@/lib/firebase";
import { discountPct, formatTime, money, toDate } from "@/lib/format";
import { useCollection, useNow } from "@/lib/hooks";
import { categories, categoryOrder, dietaryLabels, dietaryOrder } from "@/lib/meta";
import type { Category, Dietary, Plate } from "@/lib/types";

type Sort = "ending" | "price" | "discount";

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-xl bg-white ring-1 ring-stone-200">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center text-stone-500 hover:text-stone-900 disabled:opacity-30"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center font-semibold tabular">{value}</span>
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center text-stone-500 hover:text-stone-900 disabled:opacity-30"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function OrderModal({ plate, onClose }: { plate: Plate; onClose: () => void }) {
  const profile = useProfile();
  const donating = profile.role === "donor";
  const available = plate.quantity - plate.reserved;
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ pickupCode: string | null; total: number } | null>(null);
  const total = Math.round(plate.price * qty * 100) / 100;
  const off = discountPct(plate.price, plate.originalPrice);

  async function submit() {
    setBusy(true);
    try {
      const res = await api.placeOrder({ plateId: plate.id, quantity: qty, type: donating ? "donation" : "purchase" });
      setResult(res);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Modal open onClose={onClose} title={donating ? "Thank you for your generosity" : "You're all set!"} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Keep browsing</Button>
            <Button to={donating ? "/app/donations" : "/app/orders"}>{donating ? "View my impact" : "View my orders"}</Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            {donating ? <Heart className="size-7" /> : <CheckCircle2 className="size-7" />}
          </span>
          {donating ? (
            <p className="mt-4 text-stone-600">
              You donated <span className="font-semibold text-stone-900">{qty} meal{qty > 1 ? "s" : ""}</span> from{" "}
              {plate.restaurantName}. Community members nearby can claim {qty > 1 ? "them" : "it"} right now, and it's
              already on your year-end tax receipt.
            </p>
          ) : (
            <>
              <p className="mt-4 text-stone-600">
                Show this code at <span className="font-medium text-stone-900">{plate.restaurantName}</span> by{" "}
                {formatTime(plate.expiresAt)}.
              </p>
              <div className="mt-5 rounded-2xl bg-brand-50 px-6 py-4 ring-1 ring-brand-200">
                <PickupCode code={result.pickupCode ?? ""} size="lg" />
              </div>
            </>
          )}
          <p className="mt-5 text-sm text-stone-500">
            {money(result.total)} charged to {brandLabel[profile.payment?.brand ?? "card"]} •••• {profile.payment?.last4}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={plate.title} description={plate.restaurantName} size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy} variant={donating ? "accent" : "primary"} icon={donating ? HandHeart : ShoppingBag}>
            {donating ? `Donate ${qty} meal${qty > 1 ? "s" : ""}` : "Reserve"} · {money(total)}
          </Button>
        </>
      }
    >
      <CategoryArt category={plate.category} className="h-32 rounded-2xl" />
      {plate.description && <p className="mt-4 text-[15px] leading-relaxed text-stone-600">{plate.description}</p>}
      <DietaryTags tags={plate.dietary} className="mt-3" />

      <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-stone-50 p-4 text-sm">
        <div>
          <dt className="text-stone-500">Pick up by</dt>
          <dd className="mt-0.5 font-medium text-stone-900">{formatTime(plate.expiresAt)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Where</dt>
          <dd className="mt-0.5 font-medium text-stone-900">{plate.restaurantAddress}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Price</dt>
          <dd className="mt-0.5 font-medium text-stone-900">
            {money(plate.price)}
            {off > 0 && <span className="ml-1.5 text-xs font-normal text-stone-400 line-through">{money(plate.originalPrice)}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Available</dt>
          <dd className="mt-0.5 font-medium text-stone-900">{available} left</dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-stone-900">{donating ? "Meals to donate" : "Quantity"}</p>
          <p className="text-xs text-stone-500">
            Paying with {brandLabel[profile.payment?.brand ?? "card"]} •••• {profile.payment?.last4}
          </p>
        </div>
        <Stepper value={qty} max={Math.min(10, available)} onChange={setQty} />
      </div>
      {donating && (
        <p className="mt-4 rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-600">
          Each meal you donate becomes a free, claimable meal for a community member.
        </p>
      )}
    </Modal>
  );
}

export default function Marketplace() {
  const profile = useProfile();
  const donating = profile.role === "donor";
  const now = useNow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [diet, setDiet] = useState<Dietary | "">("");
  const [sort, setSort] = useState<Sort>("ending");

  const [since] = useState(() => Timestamp.now());
  const { data: plates, loading } = useCollection<Plate>(
    query(collection(db, "plates"), where("status", "==", "active"), where("expiresAt", ">", since), orderBy("expiresAt", "asc")),
    "marketplace",
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = plates.filter(
      (p) =>
        p.quantity - p.reserved > 0 &&
        (toDate(p.expiresAt)?.getTime() ?? 0) > now &&
        (category === "all" || p.category === category) &&
        (!diet || p.dietary?.includes(diet)) &&
        (!q || `${p.title} ${p.restaurantName} ${p.description}`.toLowerCase().includes(q)),
    );
    if (sort === "price") list.sort((a, b) => a.price - b.price);
    if (sort === "discount") list.sort((a, b) => discountPct(b.price, b.originalPrice) - discountPct(a.price, a.originalPrice));
    return list;
  }, [plates, search, category, diet, sort, now]);

  const selected = plates.find((p) => p.id === selectedId) ?? null;
  const restaurantCount = new Set(visible.map((p) => p.restaurantId)).size;

  return (
    <>
      <PageHeader
        eyebrow={donating ? "Donate" : "Marketplace"}
        title={donating ? "Feed a neighbor tonight" : "Rescue something delicious"}
        description={
          donating
            ? "Every plate you buy here becomes a free meal that a community member can claim and pick up."
            : "Surplus food from local kitchens at a fraction of the menu price. Reserve now, pick up before the window closes."
        }
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search dishes, restaurants…"
            leading={<Search className="size-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Select value={diet} onChange={(e) => setDiet(e.target.value as Dietary | "")} className="min-w-40" aria-label="Dietary filter">
            <option value="">Any diet</option>
            {dietaryOrder.map((d) => (
              <option key={d} value={d}>{dietaryLabels[d]}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-w-44" aria-label="Sort">
            <option value="ending">Ending soonest</option>
            <option value="price">Lowest price</option>
            <option value="discount">Biggest discount</option>
          </Select>
        </div>
      </div>

      <div className="scrollbar-none -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={category === "all"} onClick={() => setCategory("all")} icon={SlidersHorizontal}>All</Chip>
        {categoryOrder.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)} icon={categories[c].icon}>
            {categories[c].label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Store}
          title={plates.length ? "No matches" : "Nothing listed right now"}
          description={
            plates.length
              ? "Try a different search or filter."
              : "Restaurants post surplus throughout the day, especially near closing time. Check back soon."
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-stone-500">
            {visible.length} listing{visible.length === 1 ? "" : "s"} from {restaurantCount} restaurant{restaurantCount === 1 ? "" : "s"}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((p) => {
              const left = p.quantity - p.reserved;
              return (
                <PlateCard
                  key={p.id}
                  {...p}
                  now={now}
                  onClick={() => setSelectedId(p.id)}
                  footer={
                    <div className="flex items-center justify-between">
                      <span className={left <= 3 ? "text-xs font-medium text-accent-600" : "text-xs text-stone-500"}>
                        {left <= 3 ? `Only ${left} left` : `${left} available`}
                      </span>
                      <Button size="sm" variant={donating ? "accent" : "primary"} icon={donating ? HandHeart : ShoppingBag}>
                        {donating ? "Donate" : "Reserve"}
                      </Button>
                    </div>
                  }
                />
              );
            })}
          </div>
        </>
      )}

      {selected && <OrderModal key={selected.id} plate={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}
