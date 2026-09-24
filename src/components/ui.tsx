import clsx from "clsx";
import { ChevronDown, Loader2, X, type LucideIcon } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { initials } from "@/lib/format";
import type { Tone } from "@/lib/meta";

export const cn = clsx;

// ---------- Brand ----------

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="16" fill={light ? "#ffffff" : "#124032"} />
        <path d="M32 14c-8 6-13 13-13 21a13 13 0 0 0 26 0c0-8-5-15-13-21Z" fill={light ? "#1a7a57" : "#7fcfab"} />
        <path
          d="M32 24v26M32 36l-6-5M32 42l6-5"
          stroke={light ? "#ffffff" : "#124032"}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className={cn("font-display text-[1.15rem] font-semibold tracking-tight", light ? "text-white" : "text-brand-950")}>
        Waste Not Kitchen
      </span>
    </span>
  );
}

// ---------- Buttons ----------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-900 shadow-sm disabled:opacity-50",
  accent: "bg-accent-500 text-white hover:bg-accent-600 shadow-sm disabled:opacity-50",
  secondary: "bg-white text-stone-800 ring-1 ring-stone-200 hover:bg-stone-50 hover:ring-stone-300 shadow-sm",
  outline: "bg-transparent text-brand-800 ring-1 ring-brand-800/25 hover:bg-brand-50",
  ghost: "bg-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-900",
  danger: "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 hover:ring-red-300",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  to?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon: Icon,
  to,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150",
    "active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
    variants[variant],
    sizes[size],
    className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" strokeWidth={2.2} /> : null}
      {children}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900",
        className,
      )}
      {...rest}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

// ---------- Form controls ----------

const controlBase =
  "w-full rounded-xl border-0 bg-white px-3.5 text-sm text-stone-900 shadow-sm ring-1 ring-stone-200 transition " +
  "placeholder:text-stone-400 hover:ring-stone-300 focus:outline-none focus:ring-2 focus:ring-brand-500 " +
  "disabled:bg-stone-50 disabled:text-stone-500 aria-[invalid=true]:ring-red-400";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode }>(
  function Input({ className, leading, ...rest }, ref) {
    if (leading) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-stone-400">{leading}</span>
          <input ref={ref} className={cn(controlBase, "h-11 pl-10", className)} {...rest} />
        </div>
      );
    }
    return <input ref={ref} className={cn(controlBase, "h-11", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(controlBase, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(controlBase, "h-11 appearance-none pr-10", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-400" />
    </div>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-[13px] font-medium text-stone-700">
        {label}
        {optional && <span className="text-xs font-normal text-stone-400">Optional</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

// ---------- Surfaces ----------

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl bg-white shadow-card ring-1 ring-stone-900/5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-stone-900">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs font-semibold tracking-wider text-brand-600 uppercase">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const tones: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  gray: "bg-stone-100 text-stone-600 ring-stone-500/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
};

const dots: Record<Tone, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  blue: "bg-sky-500",
  red: "bg-red-500",
  gray: "bg-stone-400",
  violet: "bg-violet-500",
};

export function Badge({ tone = "gray", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-semibold text-brand-800",
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  tone?: "brand" | "accent" | "sky" | "violet";
}) {
  const iconTone = {
    brand: "bg-brand-50 text-brand-700",
    accent: "bg-accent-50 text-accent-600",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-stone-500">{label}</p>
        {Icon && (
          <span className={cn("inline-flex size-8 items-center justify-center rounded-lg", iconTone)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-[1.75rem] leading-none font-semibold tracking-tight text-stone-900">{value}</p>
      {sub && <p className="mt-2 text-xs text-stone-500">{sub}</p>}
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        <Icon className="size-6" />
      </span>
      <h3 className="text-[15px] font-semibold text-stone-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-stone-200/70", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-brand-600", className)} />;
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-7" />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-stone-200/60 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
            value === o.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] tabular",
                value === o.value ? "bg-brand-100 text-brand-800" : "bg-stone-300/60 text-stone-600",
              )}
            >
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition",
        active
          ? "bg-brand-900 text-white shadow-sm"
          : "bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stone-900 hover:ring-stone-300",
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </button>
  );
}

/** Big, legible pickup code with character grouping. */
export function PickupCode({ code, size = "md" }: { code: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono font-semibold tracking-[0.2em] text-brand-900",
        size === "lg" ? "text-3xl" : "text-lg",
      )}
      aria-label={`Pickup code ${code.split("").join(" ")}`}
    >
      {code.slice(0, 3)}
      <span className="text-stone-300">·</span>
      {code.slice(3)}
    </span>
  );
}

// ---------- Modal ----------

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-stone-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-[92vh] w-full animate-pop flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl",
          { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mt-1 -mr-2" />
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
