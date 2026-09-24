import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ArrowLeft, ArrowRight, Check, Lock, Mail } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { AuthLayout } from "@/components/AuthLayout";
import { emptyPayment, PaymentFields, toSnapshot, type PaymentDraft } from "@/components/PaymentFields";
import { Button, cn, Field, Input } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { auth, db } from "@/lib/firebase";
import { roles } from "@/lib/meta";
import type { Role } from "@/lib/types";

const selectable: Role[] = ["customer", "donor", "restaurant", "needy"];

function RolePicker({ value, onChange }: { value: Role | null; onChange: (r: Role) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {selectable.map((r) => {
        const meta = roles[r];
        const active = value === r;
        return (
          <button
            type="button"
            key={r}
            onClick={() => onChange(r)}
            className={cn(
              "group relative rounded-2xl bg-white p-5 text-left ring-1 transition",
              active ? "shadow-lift ring-2 ring-brand-600" : "shadow-card ring-stone-900/5 hover:ring-stone-300",
            )}
          >
            <span
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-xl transition",
                active ? "bg-brand-800 text-white" : "bg-brand-50 text-brand-700",
              )}
            >
              <meta.icon className="size-5" />
            </span>
            {active && (
              <span className="absolute top-4 right-4 inline-flex size-5 items-center justify-center rounded-full bg-brand-600 text-white">
                <Check className="size-3" />
              </span>
            )}
            <p className="mt-4 font-semibold text-stone-900">{r === "needy" ? "I need a meal" : `I'm a ${meta.label.toLowerCase()}`}</p>
            <p className="mt-1 text-sm leading-relaxed text-stone-500">{meta.blurb}</p>
          </button>
        );
      })}
    </div>
  );
}

export function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Signed in but no profile yet (e.g. sign-up was interrupted): only collect profile details.
  const completingProfile = !!user;

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", address: "", cuisine: "" });
  const [payment, setPayment] = useState<PaymentDraft>(emptyPayment);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const needsPayment = role === "customer" || role === "donor";
  const paymentCheck = useMemo(() => toSnapshot(payment), [payment]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const errors = {
    name: form.name.trim().length < 2 ? (role === "restaurant" ? "Enter your restaurant's name." : "Enter your full name.") : null,
    email: !completingProfile && !/^\S+@\S+\.\S+$/.test(form.email) ? "Enter a valid email." : null,
    password: !completingProfile && form.password.length < 8 ? "Use at least 8 characters." : null,
    phone: role !== "needy" && form.phone.replace(/\D/g, "").length < 7 ? "Enter a phone number." : null,
    address: form.address.trim().length < 5 ? "Enter an address." : null,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!role) return;
    if (Object.values(errors).some(Boolean) || (needsPayment && !paymentCheck.snapshot)) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setBusy(true);
    try {
      const current = user ?? (await createUserWithEmailAndPassword(auth, form.email.trim(), form.password)).user;
      await setDoc(doc(db, "users", current.uid), {
        role,
        name: form.name.trim(),
        email: current.email,
        phone: form.phone.trim() || null,
        address: form.address.trim(),
        status: "active",
        ...(needsPayment ? { payment: paymentCheck.snapshot } : {}),
        ...(role === "restaurant" && form.cuisine.trim() ? { restaurant: { cuisine: form.cuisine.trim() } } : {}),
        createdAt: serverTimestamp(),
      });
      toast.success(`Welcome to Waste Not Kitchen, ${form.name.trim().split(" ")[0]}!`);
      navigate("/app", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout wide>
      <div className="mb-8 flex items-center gap-3 text-xs font-medium text-stone-400">
        <span className={cn("inline-flex items-center gap-2", step >= 1 && "text-brand-700")}>
          <span className={cn("inline-flex size-6 items-center justify-center rounded-full", step > 1 ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-800")}>
            {step > 1 ? <Check className="size-3.5" /> : 1}
          </span>
          Choose account
        </span>
        <span className="h-px w-8 bg-stone-200" />
        <span className={cn("inline-flex items-center gap-2", step === 2 && "text-brand-700")}>
          <span className={cn("inline-flex size-6 items-center justify-center rounded-full", step === 2 ? "bg-brand-100 text-brand-800" : "bg-stone-100")}>2</span>
          Your details
        </span>
      </div>

      {step === 1 ? (
        <>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
            {completingProfile ? "Finish setting up your account" : "Join Waste Not Kitchen"}
          </h1>
          <p className="mt-2 text-stone-500">How will you use Waste Not Kitchen?</p>
          <div className="mt-8">
            <RolePicker value={role} onChange={setRole} />
          </div>
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-stone-500">
              {completingProfile ? (
                <button type="button" className="font-medium text-brand-700" onClick={() => auth.signOut()}>
                  Use a different account
                </button>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link to="/login" className="font-medium text-brand-700 hover:text-brand-900">
                    Sign in
                  </Link>
                </>
              )}
            </p>
            <Button disabled={!role} onClick={() => setStep(2)} icon={ArrowRight} className="flex-row-reverse">
              Continue
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900"
          >
            <ArrowLeft className="size-4" /> {role && roles[role].label}
          </button>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-stone-900">
            {role === "restaurant" ? "Tell us about your restaurant" : "Create your account"}
          </h1>

          <div className="mt-8 space-y-8">
            {!completingProfile && (
              <section className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" error={show("email")}>
                  {(id) => (
                    <Input id={id} type="email" autoComplete="email" leading={<Mail className="size-4" />} value={form.email} onChange={set("email")} aria-invalid={!!show("email")} />
                  )}
                </Field>
                <Field label="Password" error={show("password")} hint="At least 8 characters.">
                  {(id) => (
                    <Input id={id} type="password" autoComplete="new-password" leading={<Lock className="size-4" />} value={form.password} onChange={set("password")} aria-invalid={!!show("password")} />
                  )}
                </Field>
              </section>
            )}

            <section className="grid gap-4 sm:grid-cols-2">
              <Field label={role === "restaurant" ? "Restaurant name" : "Full name"} error={show("name")} className="sm:col-span-2">
                {(id) => <Input id={id} autoComplete={role === "restaurant" ? "organization" : "name"} value={form.name} onChange={set("name")} aria-invalid={!!show("name")} />}
              </Field>
              <Field label="Phone" error={show("phone")} optional={role === "needy"}>
                {(id) => <Input id={id} type="tel" autoComplete="tel" placeholder="(555) 123-4567" value={form.phone} onChange={set("phone")} aria-invalid={!!show("phone")} />}
              </Field>
              {role === "restaurant" ? (
                <Field label="Cuisine" optional>
                  {(id) => <Input id={id} placeholder="Italian, bakery, vegan…" value={form.cuisine} onChange={set("cuisine")} />}
                </Field>
              ) : (
                <div className="hidden sm:block" />
              )}
              <Field
                label={role === "restaurant" ? "Pickup address" : "Address"}
                error={show("address")}
                className="sm:col-span-2"
                hint={role === "restaurant" ? "Shown to customers so they know where to collect orders." : undefined}
              >
                {(id) => <Input id={id} autoComplete="street-address" value={form.address} onChange={set("address")} aria-invalid={!!show("address")} />}
              </Field>
            </section>

            {needsPayment && (
              <section>
                <h2 className="mb-4 text-sm font-semibold text-stone-900">Payment method</h2>
                <PaymentFields value={payment} onChange={setPayment} errors={submitted ? paymentCheck.errors : {}} />
              </section>
            )}
          </div>

          <div className="mt-10 flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-stone-400">By continuing you agree to use Waste Not Kitchen responsibly.</p>
            <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
              Create account
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
