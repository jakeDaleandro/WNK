import { sendPasswordResetEmail } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { CreditCard, KeyRound, LogOut, Save } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth, useProfile } from "@/auth/AuthProvider";
import { CardFace, emptyPayment, PaymentFields, toSnapshot, type PaymentDraft } from "@/components/PaymentFields";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { auth, db } from "@/lib/firebase";
import { formatDate } from "@/lib/format";
import { roles } from "@/lib/meta";

function ProfileCard() {
  const profile = useProfile();
  const [form, setForm] = useState({
    name: profile.name,
    phone: profile.phone ?? "",
    address: profile.address,
    cuisine: profile.restaurant?.cuisine ?? "",
    hours: profile.restaurant?.hours ?? "",
    description: profile.restaurant?.description ?? "",
  });
  const [busy, setBusy] = useState(false);
  const isRestaurant = profile.role === "restaurant";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const errors = {
    name: form.name.trim().length < 2 ? "Required." : null,
    phone: profile.role !== "needy" && form.phone.replace(/\D/g, "").length < 7 ? "Enter a phone number." : null,
    address: form.address.trim().length < 5 ? "Enter an address." : null,
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", profile.id), {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim(),
        ...(isRestaurant
          ? { restaurant: { cuisine: form.cuisine.trim(), hours: form.hours.trim(), description: form.description.trim() } }
          : {}),
        updatedAt: serverTimestamp(),
      });
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title={isRestaurant ? "Restaurant profile" : "Profile"} description="Shown on your orders and receipts." />
      <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label={isRestaurant ? "Restaurant name" : "Full name"} error={errors.name} className="sm:col-span-2">
          {(id) => <Input id={id} value={form.name} onChange={set("name")} />}
        </Field>
        <Field label="Phone" error={errors.phone} optional={profile.role === "needy"}>
          {(id) => <Input id={id} type="tel" value={form.phone} onChange={set("phone")} />}
        </Field>
        <Field label="Email" hint="Contact support to change your sign-in email.">
          {(id) => <Input id={id} value={profile.email} disabled />}
        </Field>
        <Field label={isRestaurant ? "Pickup address" : "Address"} error={errors.address} className="sm:col-span-2">
          {(id) => <Input id={id} value={form.address} onChange={set("address")} />}
        </Field>
        {isRestaurant && (
          <>
            <Field label="Cuisine" optional>
              {(id) => <Input id={id} value={form.cuisine} onChange={set("cuisine")} maxLength={40} />}
            </Field>
            <Field label="Usual pickup hours" optional>
              {(id) => <Input id={id} value={form.hours} onChange={set("hours")} placeholder="Weekdays 7–9 PM" maxLength={80} />}
            </Field>
            <Field label="About" optional className="sm:col-span-2">
              {(id) => <Textarea id={id} value={form.description} onChange={set("description")} maxLength={400} rows={3} />}
            </Field>
          </>
        )}
        {isRestaurant && (
          <p className="text-xs text-stone-500 sm:col-span-2">
            Name and address changes apply to new listings. Existing listings keep the details they were posted with.
          </p>
        )}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" icon={Save} loading={busy}>Save changes</Button>
        </div>
      </form>
    </Card>
  );
}

function PaymentCard() {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PaymentDraft>(emptyPayment);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const check = useMemo(() => toSnapshot(draft), [draft]);
  const p = profile.payment;

  async function save() {
    setSubmitted(true);
    if (!check.snapshot) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", profile.id), { payment: check.snapshot, updatedAt: serverTimestamp() });
      toast.success("Payment method updated.");
      setEditing(false);
      setDraft(emptyPayment);
      setSubmitted(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Payment method"
        description="Used for reservations and donations."
        action={!editing && <Button size="sm" variant="secondary" icon={CreditCard} onClick={() => setEditing(true)}>Replace card</Button>}
      />
      <div className="p-5 sm:p-6">
        {editing ? (
          <>
            <PaymentFields value={draft} onChange={setDraft} errors={submitted ? check.errors : {}} />
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button loading={busy} onClick={save}>Save card</Button>
            </div>
          </>
        ) : p ? (
          <CardFace brand={p.brand} last4={p.last4} holder={p.holder} expiry={`${String(p.expMonth).padStart(2, "0")}/${String(p.expYear).slice(2)}`} />
        ) : (
          <p className="text-sm text-stone-500">No card on file.</p>
        )}
      </div>
    </Card>
  );
}

export default function Account() {
  const profile = useProfile();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const RoleIcon = roles[profile.role].icon;

  async function reset() {
    setSending(true);
    try {
      await sendPasswordResetEmail(auth, profile.email);
      toast.success(`Password reset link sent to ${profile.email}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Settings" title="Account" description="Manage your profile, payment method and sign-in." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProfileCard />
          {(profile.role === "customer" || profile.role === "donor") && <PaymentCard />}
        </div>
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <RoleIcon className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-stone-900">{roles[profile.role].label} account</p>
                <p className="text-sm text-stone-500">Member since {formatDate(profile.createdAt, { month: "long", year: "numeric" })}</p>
              </div>
            </div>
            <div className="mt-4">
              <Badge tone="green" dot>Active</Badge>
            </div>
          </Card>
          <Card>
            <CardHeader title="Sign-in & security" />
            <div className="space-y-3 p-5 sm:p-6">
              <Button variant="secondary" icon={KeyRound} className="w-full" loading={sending} onClick={reset}>
                Email me a password reset link
              </Button>
              <Button
                variant="ghost"
                icon={LogOut}
                className="w-full"
                onClick={async () => {
                  await signOut();
                  navigate("/");
                }}
              >
                Sign out
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
