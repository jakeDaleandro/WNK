import { Clock, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { discountPct, formatTime, minutesLeft, money, timeLeft } from "@/lib/format";
import { categories, dietaryLabels } from "@/lib/meta";
import type { Category, Dietary } from "@/lib/types";
import { cn } from "./ui";

export function CategoryArt({ category, className, size = "md" }: { category: Category; className?: string; size?: "sm" | "md" }) {
  const meta = categories[category] ?? categories.other;
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-gradient-to-br", meta.tint, className)}>
      <svg className="absolute inset-0 size-full opacity-[0.35]" aria-hidden>
        <defs>
          <pattern id={`dots-${category}`} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" className="fill-white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#dots-${category})`} />
      </svg>
      <meta.icon className={cn("relative", meta.ink, size === "sm" ? "size-6" : "size-11")} strokeWidth={1.5} />
    </div>
  );
}

export function Countdown({ expiresAt, now }: { expiresAt: Parameters<typeof timeLeft>[0]; now: number }) {
  const mins = minutesLeft(expiresAt, now);
  const urgent = mins > 0 && mins < 60;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        urgent ? "bg-red-50 text-red-700" : "bg-white/90 text-stone-700 shadow-sm",
      )}
    >
      <Clock className="size-3" />
      {timeLeft(expiresAt, now)}
    </span>
  );
}

export function DietaryTags({ tags, className }: { tags: Dietary[]; className?: string }) {
  if (!tags?.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((t) => (
        <span key={t} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
          {dietaryLabels[t]}
        </span>
      ))}
    </div>
  );
}

export function PlateCard({
  title,
  restaurantName,
  restaurantAddress,
  description,
  category,
  dietary,
  price,
  originalPrice,
  expiresAt,
  now,
  footer,
  badge,
  onClick,
}: {
  title: string;
  restaurantName: string;
  restaurantAddress: string;
  description?: string;
  category: Category;
  dietary: Dietary[];
  price?: number;
  originalPrice?: number | null;
  expiresAt: Parameters<typeof timeLeft>[0];
  now: number;
  footer?: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  const off = price !== undefined ? discountPct(price, originalPrice ?? null) : 0;
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-stone-900/5 transition",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lift",
      )}
      onClick={onClick}
    >
      <div className="relative">
        <CategoryArt category={category} className="h-36" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Countdown expiresAt={expiresAt} now={now} />
        </div>
        <div className="absolute top-3 right-3 flex gap-1.5">
          {off > 0 && (
            <span className="rounded-full bg-accent-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">−{off}%</span>
          )}
          {badge}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-stone-900">{title}</h3>
            <p className="truncate text-sm text-stone-500">{restaurantName}</p>
          </div>
          {price !== undefined && (
            <div className="shrink-0 text-right">
              <p className="font-semibold text-brand-800 tabular">{money(price)}</p>
              {off > 0 && <p className="text-xs text-stone-400 line-through tabular">{money(originalPrice)}</p>}
            </div>
          )}
        </div>
        {description && <p className="mt-2 line-clamp-2 text-sm text-stone-500">{description}</p>}
        <DietaryTags tags={dietary} className="mt-3" />
        <div className="mt-auto space-y-1 pt-4 text-xs text-stone-500">
          <p className="flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" /> Pick up by {formatTime(expiresAt)}
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <MapPin className="size-3.5 shrink-0" /> {restaurantAddress}
          </p>
        </div>
        {footer && <div className="mt-4 border-t border-stone-100 pt-4">{footer}</div>}
      </div>
    </article>
  );
}
