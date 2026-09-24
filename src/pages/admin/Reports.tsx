import { collection, query } from "firebase/firestore";
import { BarChart3, Check, Download, Eye, FileText, HandHeart, ShoppingBag, Store, Users, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, cn, Field, Input, PageHeader, Select } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { db } from "@/lib/firebase";
import { toLocalInput } from "@/lib/format";
import { useCollection } from "@/lib/hooks";
import type { Role, UserProfile } from "@/lib/types";

type Kind = "platform" | "restaurant" | "customer" | "donor" | "needy";

const kinds: { id: Kind; title: string; icon: LucideIcon; description: string; role?: Role; includes: string[] }[] = [
  {
    id: "platform",
    title: "Platform impact",
    icon: BarChart3,
    description: "Everything happening on Waste Not Kitchen over a period of your choosing.",
    includes: ["8 headline KPIs", "Meals rescued over time (purchased vs. donated)", "Top restaurants chart", "Donated-meal outcomes", "Restaurant leaderboard", "Membership breakdown"],
  },
  {
    id: "restaurant",
    title: "Restaurant statement",
    icon: Store,
    role: "restaurant",
    description: "Annual activity statement for a partner restaurant.",
    includes: ["Plates sold & donated", "Monthly revenue chart", "Performance by item", "Month-by-month summary", "Community impact note"],
  },
  {
    id: "customer",
    title: "Customer history",
    icon: ShoppingBag,
    role: "customer",
    description: "A customer's purchases for the year, with savings.",
    includes: ["Spend and savings KPIs", "Monthly spending chart", "Itemized order list"],
  },
  {
    id: "donor",
    title: "Donor tax receipt",
    icon: HandHeart,
    role: "donor",
    description: "Year-end charitable contribution receipt for a donor.",
    includes: ["Total contributed", "Monthly contributions chart", "Itemized contributions", "Meals delivered to neighbors"],
  },
  {
    id: "needy",
    title: "Community member summary",
    icon: Users,
    role: "needy",
    description: "Free meals a community member claimed and received in a year.",
    includes: ["Meals received & value", "Monthly meals chart", "Meal history"],
  },
];

type Preset = "month" | "lastMonth" | "quarter" | "ytd" | "12m" | "custom";

function presetRange(p: Exclude<Preset, "custom">): [Date, Date] {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  switch (p) {
    case "month":
      return [new Date(y, mo, 1), now];
    case "lastMonth":
      return [new Date(y, mo - 1, 1), new Date(y, mo, 0, 23, 59, 59)];
    case "quarter":
      return [new Date(y, Math.floor(mo / 3) * 3, 1), now];
    case "ytd":
      return [new Date(y, 0, 1), now];
    case "12m":
      return [new Date(y, mo - 11, 1), now];
  }
}

export default function Reports() {
  const [params] = useSearchParams();
  const { data: users } = useCollection<UserProfile>(query(collection(db, "users")), "admin-users");
  const [kind, setKind] = useState<Kind>("platform");
  const [memberId, setMemberId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState(() => {
    const [f, t] = presetRange("month");
    return { from: toLocalInput(f).slice(0, 10), to: toLocalInput(t).slice(0, 10) };
  });
  const [busy, setBusy] = useState<"preview" | "download" | null>(null);

  // Deep link from the Members page: /app/admin/reports?member=<uid>
  useEffect(() => {
    const id = params.get("member");
    const member = users.find((u) => u.id === id);
    if (member && member.role !== "admin") {
      setKind(member.role as Kind);
      setMemberId(member.id);
    }
  }, [params, users]);

  const def = kinds.find((k) => k.id === kind)!;
  const candidates = useMemo(
    () => users.filter((u) => u.role === def.role).sort((a, b) => a.name.localeCompare(b.name)),
    [users, def.role],
  );
  const member = candidates.find((u) => u.id === memberId);
  const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

  async function generate(mode: "preview" | "download") {
    if (def.role && !member) {
      toast.error(`Choose a ${def.title.split(" ")[0].toLowerCase()} first.`);
      return;
    }
    // Open the preview tab synchronously so pop-up blockers allow it.
    const tab = mode === "preview" ? window.open("", "_blank") : null;
    setBusy(mode);
    try {
      const b = await import("@/reports/builders");
      const d = await import("@/reports/data");
      let pdf;
      let name: string;
      if (kind === "platform") {
        const [from, to] =
          preset === "custom"
            ? [new Date(`${custom.from}T00:00:00`), new Date(`${custom.to}T23:59:59`)]
            : presetRange(preset);
        if (!(from < to)) throw new Error("The start date must be before the end date.");
        const data = await d.loadPlatform(from, to);
        pdf = b.platformReport({ from, to, ...data });
        name = b.fileName("platform-impact", "report", `${custom.from}-${custom.to}`);
        if (preset !== "custom") name = b.fileName("platform-impact", preset, from.toISOString().slice(0, 10));
      } else if (kind === "restaurant") {
        pdf = b.restaurantStatement({ restaurant: member!, year, ...(await d.loadRestaurant(member!.id, year)) });
        name = b.fileName("statement", member!.name, String(year));
      } else if (kind === "customer") {
        pdf = b.customerHistory({ customer: member!, year, ...(await d.loadCustomer(member!.id, year)) });
        name = b.fileName("purchases", member!.name, String(year));
      } else if (kind === "donor") {
        pdf = b.donorReceipt({ donor: member!, year, ...(await d.loadDonor(member!.id, year)) });
        name = b.fileName("tax-receipt", member!.name, String(year));
      } else {
        pdf = b.communityReport({ member: member!, year, ...(await d.loadCommunityMember(member!.id, year)) });
        name = b.fileName("meals", member!.name, String(year));
      }

      if (tab) tab.location.href = String(pdf.output("bloburl"));
      else pdf.save(name);
      toast.success(mode === "preview" ? "Report opened in a new tab." : "Report downloaded.");
    } catch (err) {
      tab?.close();
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Reports"
        description="Generate print-ready PDF reports with charts and itemized tables."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-3">
          {kinds.map((k) => (
            <button
              key={k.id}
              onClick={() => {
                setKind(k.id);
                setMemberId("");
              }}
              className={cn(
                "flex w-full items-start gap-4 rounded-2xl bg-white p-4 text-left ring-1 transition",
                kind === k.id ? "shadow-lift ring-2 ring-brand-600" : "shadow-card ring-stone-900/5 hover:ring-stone-300",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
                  kind === k.id ? "bg-brand-800 text-white" : "bg-brand-50 text-brand-700",
                )}
              >
                <k.icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold text-stone-900">{k.title}</span>
                <span className="mt-0.5 block text-sm text-stone-500">{k.description}</span>
              </span>
            </button>
          ))}
        </div>

        <Card className="h-fit p-6 sm:p-8 lg:sticky lg:top-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <FileText className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">{def.title}</h2>
              <p className="text-sm text-stone-500">PDF · US Letter</p>
            </div>
          </div>

          <div className="mt-7 space-y-5">
            {kind === "platform" ? (
              <>
                <Field label="Period">
                  {(id) => (
                    <Select id={id} value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
                      <option value="month">This month</option>
                      <option value="lastMonth">Last month</option>
                      <option value="quarter">This quarter</option>
                      <option value="ytd">Year to date</option>
                      <option value="12m">Last 12 months</option>
                      <option value="custom">Custom range…</option>
                    </Select>
                  )}
                </Field>
                {preset === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="From">
                      {(id) => <Input id={id} type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />}
                    </Field>
                    <Field label="To">
                      {(id) => <Input id={id} type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />}
                    </Field>
                  </div>
                )}
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field label={def.title.split(" ")[0]} hint={candidates.length ? undefined : "No members of this type yet."}>
                  {(id) => (
                    <Select id={id} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                      <option value="">Select…</option>
                      {candidates.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Year">
                  {(id) => (
                    <Select id={id} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
            )}
          </div>

          <div className="mt-7 rounded-2xl bg-stone-50 p-5">
            <p className="text-xs font-semibold tracking-wider text-stone-500 uppercase">Included</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {def.includes.map((i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-600" /> {i}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" icon={Eye} loading={busy === "preview"} disabled={!!busy} onClick={() => generate("preview")}>
              Preview
            </Button>
            <Button icon={Download} loading={busy === "download"} disabled={!!busy} onClick={() => generate("download")}>
              Download PDF
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
