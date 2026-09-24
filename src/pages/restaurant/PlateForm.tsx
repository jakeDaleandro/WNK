import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useProfile } from "@/auth/AuthProvider";
import { Button, Chip, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { db } from "@/lib/firebase";
import { discountPct, toDate, toLocalInput } from "@/lib/format";
import { categories, categoryOrder, dietaryLabels, dietaryOrder } from "@/lib/meta";
import type { Category, Dietary, Plate } from "@/lib/types";

function presets(): { label: string; date: Date }[] {
  const now = new Date();
  const inTwo = new Date(now.getTime() + 2 * 3600_000);
  inTwo.setMinutes(Math.ceil(inTwo.getMinutes() / 15) * 15, 0, 0);
  const tonight = new Date(now);
  tonight.setHours(21, 0, 0, 0);
  const tomorrowNoon = new Date(now);
  tomorrowNoon.setDate(now.getDate() + 1);
  tomorrowNoon.setHours(12, 0, 0, 0);
  return [
    { label: "In 2 hours", date: inTwo },
    ...(tonight.getTime() - now.getTime() > 30 * 60_000 ? [{ label: "Tonight, 9 PM", date: tonight }] : []),
    { label: "Tomorrow, noon", date: tomorrowNoon },
  ];
}

export type PlateDraftSource = Partial<Plate> & { id?: string };

export function PlateForm({ source, onClose }: { source: PlateDraftSource | null; onClose: () => void }) {
  const profile = useProfile();
  const editing = !!source?.id;
  const defaultExpiry = toDate(source?.expiresAt ?? null);
  const [form, setForm] = useState({
    title: source?.title ?? "",
    description: source?.description ?? "",
    category: (source?.category ?? "entree") as Category,
    dietary: (source?.dietary ?? []) as Dietary[],
    price: source?.price !== undefined ? String(source.price) : "",
    originalPrice: source?.originalPrice ? String(source.originalPrice) : "",
    quantity: source?.quantity !== undefined ? String(source.quantity) : "5",
    expiresAt: toLocalInput(editing && defaultExpiry ? defaultExpiry : presets()[0].date),
  });
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const minQty = editing ? Math.max(source?.reserved ?? 0, 1) : 1;

  const price = Number(form.price);
  const original = form.originalPrice ? Number(form.originalPrice) : null;
  const qty = Number(form.quantity);
  const expiry = new Date(form.expiresAt);

  const errors = {
    title: form.title.trim().length < 3 ? "Give the listing a name (3+ characters)." : null,
    price: !form.price || isNaN(price) || price < 0 || price > 500 ? "Enter a price between $0 and $500." : null,
    originalPrice:
      original !== null && (isNaN(original) || original < price || original > 1000) ? "Must be at least the sale price." : null,
    quantity:
      !Number.isInteger(qty) || qty < minQty || qty > 500
        ? editing && minQty > 1
          ? `At least ${minQty}. That many are already sold.`
          : "Between 1 and 500."
        : null,
    expiresAt:
      isNaN(expiry.getTime()) || expiry.getTime() < Date.now() + 5 * 60_000
        ? "Pick a time at least a few minutes from now."
        : expiry.getTime() > Date.now() + 7 * 86_400_000
          ? "Listings can run up to 7 days."
          : null,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    const fields = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      dietary: form.dietary,
      price: Math.round(price * 100) / 100,
      originalPrice: original !== null ? Math.round(original * 100) / 100 : null,
      quantity: qty,
      expiresAt: Timestamp.fromDate(expiry),
    };
    try {
      if (editing) {
        await updateDoc(doc(db, "plates", source!.id!), { ...fields, status: "active", updatedAt: serverTimestamp() });
        toast.success("Listing updated.");
      } else {
        await addDoc(collection(db, "plates"), {
          ...fields,
          restaurantId: profile.id,
          restaurantName: profile.name,
          restaurantAddress: profile.address,
          reserved: 0,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.success("Listing is live on the marketplace.");
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  const off = discountPct(price || 0, original);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? "Edit listing" : "New listing"}
      description={editing ? "Changes appear on the marketplace immediately." : "Post surplus food for customers and donors to rescue."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="plate-form" loading={busy}>{editing ? "Save changes" : "Publish listing"}</Button>
        </>
      }
    >
      <form id="plate-form" onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Title" error={show("title")}>
            {(id) => <Input id={id} value={form.title} onChange={set("title")} placeholder="Roasted vegetable lasagna" maxLength={80} />}
          </Field>
          <Field label="Category">
            {(id) => (
              <Select id={id} value={form.category} onChange={set("category")}>
                {categoryOrder.map((c) => <option key={c} value={c}>{categories[c].label}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Description" optional hint="What's in it, portion size, allergens, reheating tips…">
          {(id) => <Textarea id={id} value={form.description} onChange={set("description")} maxLength={500} rows={3} />}
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-stone-700">Dietary</p>
          <div className="flex flex-wrap gap-2">
            {dietaryOrder.map((d) => (
              <Chip
                key={d}
                active={form.dietary.includes(d)}
                onClick={() =>
                  setForm({ ...form, dietary: form.dietary.includes(d) ? form.dietary.filter((x) => x !== d) : [...form.dietary, d] })
                }
              >
                {dietaryLabels[d]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Sale price" error={show("price")}>
            {(id) => <Input id={id} type="number" inputMode="decimal" min={0} step="0.25" value={form.price} onChange={set("price")} leading={<span className="text-sm">$</span>} />}
          </Field>
          <Field label="Menu price" optional error={show("originalPrice")} hint={off > 0 ? `Shown as ${off}% off` : "Shows the discount"}>
            {(id) => <Input id={id} type="number" inputMode="decimal" min={0} step="0.25" value={form.originalPrice} onChange={set("originalPrice")} leading={<span className="text-sm">$</span>} />}
          </Field>
          <Field label="Quantity" error={show("quantity")}>
            {(id) => <Input id={id} type="number" inputMode="numeric" min={minQty} max={500} value={form.quantity} onChange={set("quantity")} />}
          </Field>
        </div>

        <Field label="Pick up by" error={show("expiresAt")} hint="After this time the listing closes and unclaimed reservations expire.">
          {(id) => (
            <div className="space-y-2">
              <Input id={id} type="datetime-local" value={form.expiresAt} onChange={set("expiresAt")} />
              <div className="flex flex-wrap gap-2">
                {presets().map((p) => (
                  <Chip key={p.label} onClick={() => setForm({ ...form, expiresAt: toLocalInput(p.date) })}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </Field>
      </form>
    </Modal>
  );
}
