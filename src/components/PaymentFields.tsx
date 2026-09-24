import { CreditCard, Lock } from "lucide-react";
import { useState } from "react";
import { brandLabel, detectBrand, formatCardNumber, formatExpiry, luhnValid, parseExpiry } from "@/lib/card";
import type { PaymentSnapshot } from "@/lib/types";
import { cn, Field, Input } from "./ui";

export interface PaymentDraft {
  number: string;
  expiry: string;
  cvc: string;
  holder: string;
}

export const emptyPayment: PaymentDraft = { number: "", expiry: "", cvc: "", holder: "" };

/** Validates a draft and reduces it to the display-only snapshot we store. */
export function toSnapshot(d: PaymentDraft): { snapshot?: PaymentSnapshot; errors: Partial<Record<keyof PaymentDraft, string>> } {
  const errors: Partial<Record<keyof PaymentDraft, string>> = {};
  const digits = d.number.replace(/\D/g, "");
  const brand = detectBrand(digits);
  if (!luhnValid(digits)) errors.number = "Enter a valid card number.";
  const exp = parseExpiry(d.expiry);
  if (!exp) errors.expiry = "Use MM/YY, not expired.";
  if (!/^\d{3,4}$/.test(d.cvc)) errors.cvc = "3–4 digits.";
  if (d.holder.trim().length < 2) errors.holder = "Enter the name on the card.";
  if (Object.keys(errors).length || !exp) return { errors };
  return {
    errors,
    snapshot: { brand, last4: digits.slice(-4), expMonth: exp.month, expYear: exp.year, holder: d.holder.trim() },
  };
}

export function CardFace({ brand, last4, holder, expiry, className }: { brand: string; last4: string; holder: string; expiry: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-[1.586] w-full max-w-[300px] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-5 text-white shadow-lift",
        className,
      )}
    >
      <div className="absolute -top-16 -right-10 size-48 rounded-full bg-white/5" />
      <div className="absolute -bottom-20 -left-10 size-48 rounded-full bg-brand-500/10" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <span className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-400/80" />
          <span className="text-sm font-semibold tracking-wide">{brandLabel[brand as keyof typeof brandLabel] ?? "Card"}</span>
        </div>
        <p className="mt-auto font-mono text-lg tracking-[0.18em] tabular">•••• •••• •••• {last4 || "0000"}</p>
        <div className="mt-3 flex items-end justify-between text-xs">
          <span className="truncate uppercase opacity-80">{holder || "Name on card"}</span>
          <span className="opacity-80 tabular">{expiry || "MM/YY"}</span>
        </div>
      </div>
    </div>
  );
}

export function PaymentFields({
  value,
  onChange,
  errors,
}: {
  value: PaymentDraft;
  onChange: (v: PaymentDraft) => void;
  errors: Partial<Record<keyof PaymentDraft, string>>;
}) {
  const [touched, setTouched] = useState(false);
  const digits = value.number.replace(/\D/g, "");
  const set = (patch: Partial<PaymentDraft>) => {
    setTouched(true);
    onChange({ ...value, ...patch });
  };
  const show = (k: keyof PaymentDraft) => (touched ? errors[k] : undefined);

  return (
    <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <Field label="Card number" error={show("number")}>
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              leading={<CreditCard className="size-4" />}
              value={value.number}
              aria-invalid={!!show("number")}
              onChange={(e) => set({ number: formatCardNumber(e.target.value) })}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expiry" error={show("expiry")}>
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={value.expiry}
                aria-invalid={!!show("expiry")}
                onChange={(e) => set({ expiry: formatExpiry(e.target.value) })}
              />
            )}
          </Field>
          <Field label="CVC" error={show("cvc")}>
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                value={value.cvc}
                aria-invalid={!!show("cvc")}
                onChange={(e) => set({ cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
            )}
          </Field>
        </div>
        <Field label="Name on card" error={show("holder")}>
          {(id) => (
            <Input
              id={id}
              autoComplete="cc-name"
              placeholder="Jordan Rivera"
              value={value.holder}
              aria-invalid={!!show("holder")}
              onChange={(e) => set({ holder: e.target.value })}
            />
          )}
        </Field>
        <p className="flex items-start gap-2 text-xs text-stone-500">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Demo payments: nothing is charged. Only the card brand and last four digits are saved; the full number and
          CVC never leave your browser.
        </p>
      </div>
      <div className="hidden sm:block sm:w-[260px]">
        <CardFace brand={detectBrand(digits)} last4={digits.slice(-4)} holder={value.holder} expiry={value.expiry} />
      </div>
    </div>
  );
}
