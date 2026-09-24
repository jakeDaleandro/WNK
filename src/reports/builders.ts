import type { jsPDF } from "jspdf";
import { formatDate, money, num, toDate } from "@/lib/format";
import { categories, roles } from "@/lib/meta";
import type { Meal, Order, Role, UserProfile } from "@/lib/types";
import { palette, Report } from "./pdf";

// ---------- aggregation helpers ----------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86_400_000;

const counted = (o: Order) => o.status !== "cancelled";
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const range = (from: Date, to: Date) => `${formatDate(from)} – ${formatDate(to)}`;

interface Buckets {
  labels: string[];
  index: (d: Date) => number;
}

/** Day buckets for ≤ 31 days, weeks for ≤ ~4 months, months beyond that. */
function buckets(from: Date, to: Date): Buckets {
  const span = (to.getTime() - from.getTime()) / DAY;
  if (span <= 31) {
    const n = Math.ceil(span) || 1;
    const labels = Array.from({ length: n }, (_, i) => {
      const d = new Date(from.getTime() + i * DAY);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    return { labels, index: (d) => Math.floor((d.getTime() - from.getTime()) / DAY) };
  }
  if (span <= 125) {
    const n = Math.ceil(span / 7);
    const labels = Array.from({ length: n }, (_, i) => {
      const d = new Date(from.getTime() + i * 7 * DAY);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    return { labels, index: (d) => Math.floor((d.getTime() - from.getTime()) / (7 * DAY)) };
  }
  const labels: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) {
    labels.push(`${MONTHS[cursor.getMonth()]}${from.getFullYear() !== to.getFullYear() ? ` ’${String(cursor.getFullYear()).slice(2)}` : ""}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return {
    labels,
    index: (d) => (d.getFullYear() - from.getFullYear()) * 12 + d.getMonth() - from.getMonth(),
  };
}

function series<T>(items: T[], b: Buckets, date: (x: T) => Date | null, value: (x: T) => number) {
  const values = new Array(b.labels.length).fill(0);
  for (const it of items) {
    const d = date(it);
    if (!d) continue;
    const i = b.index(d);
    if (i >= 0 && i < values.length) values[i] += value(it);
  }
  return values;
}

const monthly = (year: number): Buckets => ({
  labels: MONTHS,
  index: (d) => (d.getFullYear() === year ? d.getMonth() : -1),
});

const orderDate = (o: Order) => toDate(o.createdAt);
const moneyShort = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`);

export function fileName(kind: string, subject: string, period: string) {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `wnk-${slug(kind)}-${slug(subject)}-${slug(period)}.pdf`;
}

// ---------- Platform impact report ----------

export function platformReport(input: { from: Date; to: Date; orders: Order[]; meals: Meal[]; users: UserProfile[] }): jsPDF {
  const { from, to } = input;
  const orders = input.orders.filter(counted);
  const purchases = orders.filter((o) => o.type === "purchase");
  const donations = orders.filter((o) => o.type === "donation");
  const mealsRescued = sum(orders, (o) => o.quantity);
  const sales = sum(purchases, (o) => o.total);
  const donated = sum(donations, (o) => o.total);
  const delivered = input.meals.filter((m) => m.status === "picked_up").length;
  const newMembers = input.users.filter((u) => {
    const d = toDate(u.createdAt);
    return d && d >= from && d <= to;
  });
  const pickedUp = purchases.filter((o) => o.status === "picked_up").length;
  const closedPurchases = purchases.filter((o) => o.status !== "reserved").length;

  const r = new Report("Platform Impact Report");
  r.header({
    kicker: "Platform impact report",
    title: "Food rescued across Waste Not Kitchen",
    meta: [
      ["Period", range(from, to)],
      ["Prepared for", "Administrators"],
    ],
    subtitle:
      `Between ${formatDate(from)} and ${formatDate(to)}, members rescued ${num(mealsRescued)} meals from ` +
      `${num(new Set(orders.map((o) => o.restaurantId)).size)} restaurants: ${num(sum(purchases, (o) => o.quantity))} purchased ` +
      `and ${num(sum(donations, (o) => o.quantity))} donated to community members.`,
  });

  r.kpis([
    { label: "Meals rescued", value: num(mealsRescued), sub: `${num(orders.length)} orders` },
    { label: "Customer sales", value: money(sales), sub: `${num(purchases.length)} purchases` },
    { label: "Donations", value: money(donated), sub: `${num(donations.length)} gifts` },
    { label: "Meals delivered", value: num(delivered), sub: "Donated meals picked up" },
    { label: "New members", value: num(newMembers.length), sub: `${num(input.users.length)} total members` },
    { label: "Pickup completion", value: pct(pickedUp, closedPurchases), sub: "Of closed reservations" },
    { label: "Avg. order value", value: money(purchases.length ? sales / purchases.length : 0), sub: "Customer purchases" },
    {
      label: "Active restaurants",
      value: num(new Set(orders.map((o) => o.restaurantId)).size),
      sub: `of ${num(input.users.filter((u) => u.role === "restaurant").length)} registered`,
    },
  ]);

  const b = buckets(from, to);
  r.section("Meals rescued over time", "Units, by order date", 230);
  if (orders.length) {
    r.columns({
      labels: b.labels,
      series: [
        { name: "Purchased", color: palette.series[0], values: series(purchases, b, orderDate, (o) => o.quantity) },
        { name: "Donated", color: palette.series[1], values: series(donations, b, orderDate, (o) => o.quantity) },
      ],
    });
  } else r.empty("No orders in this period.");

  r.section("Top restaurants", "Meals rescued", 180);
  const byRestaurant = new Map<string, { name: string; meals: number; orders: number; sales: number; donations: number }>();
  for (const o of orders) {
    const e = byRestaurant.get(o.restaurantId) ?? { name: o.restaurantName, meals: 0, orders: 0, sales: 0, donations: 0 };
    e.meals += o.quantity;
    e.orders += 1;
    if (o.type === "purchase") e.sales += o.total;
    else e.donations += o.total;
    byRestaurant.set(o.restaurantId, e);
  }
  const ranked = [...byRestaurant.values()].sort((a, b) => b.meals - a.meals);
  if (ranked.length) r.bars({ rows: ranked.slice(0, 8).map((x) => ({ label: x.name, value: x.meals })) });
  else r.empty("No restaurant activity in this period.");

  r.section("Where donated meals went", "Status of meals donated in this period", 100);
  const mealStatusRows = [
    { label: "Delivered to a neighbor", value: input.meals.filter((m) => m.status === "picked_up").length },
    { label: "Claimed, awaiting pickup", value: input.meals.filter((m) => m.status === "claimed").length },
    { label: "Available to claim", value: input.meals.filter((m) => m.status === "available").length },
    { label: "Expired unclaimed", value: input.meals.filter((m) => m.status === "expired").length },
  ];
  if (input.meals.length) r.bars({ rows: mealStatusRows, color: palette.series[2] });
  else r.empty("No meals were donated in this period.");

  r.section("Restaurant leaderboard");
  if (ranked.length) {
    r.table({
      head: ["Restaurant", "Orders", "Meals", "Sales", "Donations"],
      align: ["left", "right", "right", "right", "right"],
      body: ranked.map((x) => [x.name, num(x.orders), num(x.meals), money(x.sales), money(x.donations)]),
      foot: [["Total", num(orders.length), num(mealsRescued), money(sales), money(donated)]],
    });
  } else r.empty("No restaurant activity in this period.");

  r.section("Membership");
  const roleOrder: Role[] = ["customer", "donor", "restaurant", "needy", "admin"];
  r.table({
    head: ["Member type", "Total members", "Joined this period", "Suspended"],
    align: ["left", "right", "right", "right"],
    body: roleOrder.map((role) => [
      roles[role].label,
      num(input.users.filter((u) => u.role === role).length),
      num(newMembers.filter((u) => u.role === role).length),
      num(input.users.filter((u) => u.role === role && u.status === "suspended").length),
    ]),
    foot: [["All members", num(input.users.length), num(newMembers.length), num(input.users.filter((u) => u.status === "suspended").length)]],
  });

  return r.finish();
}

// ---------- Restaurant activity statement ----------

export function restaurantStatement(input: { restaurant: UserProfile; year: number; orders: Order[]; meals: Meal[] }): jsPDF {
  const { restaurant, year } = input;
  const orders = input.orders.filter(counted);
  const purchases = orders.filter((o) => o.type === "purchase");
  const donations = orders.filter((o) => o.type === "donation");
  const revenue = sum(orders, (o) => o.total);
  const b = monthly(year);

  const r = new Report("Restaurant Activity Statement");
  r.header({
    kicker: "Annual activity statement",
    title: restaurant.name,
    meta: [
      ["Statement year", String(year)],
      ["Restaurant ID", restaurant.id.slice(0, 10).toUpperCase()],
    ],
    subtitle: `${restaurant.address}${restaurant.phone ? ` · ${restaurant.phone}` : ""} · ${restaurant.email}`,
  });

  r.kpis([
    { label: "Plates sold", value: num(sum(purchases, (o) => o.quantity)), sub: `${num(purchases.length)} orders` },
    { label: "Plates donated", value: num(sum(donations, (o) => o.quantity)), sub: `${num(donations.length)} donor orders` },
    { label: "Gross revenue", value: money(revenue), sub: "Sales + donor purchases" },
    {
      label: "Pickup rate",
      value: pct(purchases.filter((o) => o.status === "picked_up").length, purchases.filter((o) => o.status !== "reserved").length),
      sub: "Customer reservations",
    },
  ]);

  r.section("Monthly revenue", String(year), 230);
  if (orders.length) {
    r.columns({
      labels: b.labels,
      format: moneyShort,
      series: [
        { name: "Customer sales", color: palette.series[0], values: series(purchases, b, orderDate, (o) => o.total) },
        { name: "Donor purchases", color: palette.series[1], values: series(donations, b, orderDate, (o) => o.total) },
      ],
    });
  } else r.empty(`No activity recorded in ${year}.`);

  r.section("Performance by item");
  const byPlate = new Map<string, { title: string; category: string; orders: number; units: number; revenue: number }>();
  for (const o of orders) {
    const e = byPlate.get(o.plateId) ?? { title: o.plateTitle, category: categories[o.category]?.label ?? "Other", orders: 0, units: 0, revenue: 0 };
    e.orders++;
    e.units += o.quantity;
    e.revenue += o.total;
    byPlate.set(o.plateId, e);
  }
  const items = [...byPlate.values()].sort((a, b) => b.revenue - a.revenue);
  if (items.length) {
    r.table({
      head: ["Item", "Category", "Orders", "Units", "Revenue"],
      align: ["left", "left", "right", "right", "right"],
      body: items.map((x) => [x.title, x.category, num(x.orders), num(x.units), money(x.revenue)]),
      foot: [["Total", "", num(orders.length), num(sum(orders, (o) => o.quantity)), money(revenue)]],
    });
  } else r.empty("No items sold.");

  r.section("Monthly summary");
  r.table({
    head: ["Month", "Orders", "Units sold", "Units donated", "Revenue"],
    align: ["left", "right", "right", "right", "right"],
    body: MONTHS.map((m, i) => {
      const mo = orders.filter((o) => orderDate(o)?.getMonth() === i);
      return [
        `${m} ${year}`,
        num(mo.length),
        num(sum(mo.filter((o) => o.type === "purchase"), (o) => o.quantity)),
        num(sum(mo.filter((o) => o.type === "donation"), (o) => o.quantity)),
        money(sum(mo, (o) => o.total)),
      ];
    }),
  });

  const delivered = input.meals.filter((m) => m.status === "picked_up").length;
  r.note(
    `Community impact: ${num(input.meals.length)} donated meals were redeemable at ${restaurant.name} in ${year}, ` +
      `and ${num(delivered)} were picked up by community members. Thank you for partnering with Waste Not Kitchen.`,
  );
  return r.finish();
}

// ---------- Customer purchase history ----------

export function customerHistory(input: { customer: UserProfile; year: number; orders: Order[] }): jsPDF {
  const { customer, year } = input;
  const orders = input.orders.filter((o) => o.type === "purchase");
  const valid = orders.filter(counted);
  const spent = sum(valid, (o) => o.total);
  const saved = sum(valid, (o) => (o.originalPrice ? (o.originalPrice - o.unitPrice) * o.quantity : 0));
  const b = monthly(year);

  const r = new Report("Purchase History");
  r.header({
    kicker: "Customer purchase history",
    title: customer.name,
    meta: [
      ["Year", String(year)],
      ["Member since", formatDate(customer.createdAt, { month: "short", year: "numeric" })],
    ],
    subtitle: `${customer.email} · ${customer.address}`,
  });
  r.kpis([
    { label: "Orders", value: num(valid.length), sub: `${num(orders.length - valid.length)} cancelled` },
    { label: "Meals rescued", value: num(sum(valid, (o) => o.quantity)) },
    { label: "Total spent", value: money(spent) },
    { label: "Saved vs. menu price", value: money(saved) },
  ]);

  r.section("Monthly spending", String(year), 230);
  if (valid.length) {
    r.columns({ labels: b.labels, format: moneyShort, series: [{ name: "Spent", color: palette.series[0], values: series(valid, b, orderDate, (o) => o.total) }] });
  } else r.empty(`No purchases in ${year}.`);

  r.section("Orders");
  if (orders.length) {
    r.table({
      head: ["Date", "Restaurant", "Item", "Qty", "Status", "Amount"],
      align: ["left", "left", "left", "right", "left", "right"],
      body: orders.map((o) => [
        formatDate(o.createdAt),
        o.restaurantName,
        o.plateTitle,
        num(o.quantity),
        { picked_up: "Picked up", reserved: "Reserved", cancelled: "Cancelled", expired: "Not collected", confirmed: "Confirmed" }[o.status],
        money(o.status === "cancelled" ? 0 : o.total),
      ]),
      foot: [["Total", "", "", num(sum(valid, (o) => o.quantity)), "", money(spent)]],
    });
  } else r.empty("No orders.");
  return r.finish();
}

// ---------- Donor contribution receipt ----------

export function donorReceipt(input: { donor: UserProfile; year: number; orders: Order[]; meals: Meal[] }): jsPDF {
  const { donor, year } = input;
  const orders = input.orders.filter((o) => o.type === "donation" && counted(o));
  const total = sum(orders, (o) => o.total);
  const mealCount = sum(orders, (o) => o.quantity);
  const delivered = input.meals.filter((m) => m.status === "picked_up").length;
  const b = monthly(year);

  const r = new Report("Charitable Contribution Receipt");
  r.header({
    kicker: "Year-end contribution receipt",
    title: `${year} Charitable Contributions`,
    meta: [
      ["Receipt no.", `WNK-${year}-${donor.id.slice(0, 6).toUpperCase()}`],
      ["Tax year", String(year)],
    ],
  });

  r.paragraph(`Donor: ${donor.name}`, palette.ink, 10.5);
  r.paragraph(`${donor.address}\n${donor.email}`);
  r.gap(4);

  r.kpis([
    { label: "Total contributed", value: money(total) },
    { label: "Meals donated", value: num(mealCount) },
    { label: "Meals delivered", value: num(delivered), sub: "Picked up by neighbors" },
    { label: "Restaurants supported", value: num(new Set(orders.map((o) => o.restaurantId)).size) },
  ]);

  r.section("Contributions by month", String(year), 230);
  if (orders.length) {
    r.columns({ labels: b.labels, format: moneyShort, series: [{ name: "Contributed", color: palette.series[1], values: series(orders, b, orderDate, (o) => o.total) }] });
  } else r.empty(`No contributions recorded in ${year}.`);

  r.section("Itemized contributions");
  if (orders.length) {
    r.table({
      head: ["Date", "Restaurant", "Meal", "Meals", "Delivered", "Amount"],
      align: ["left", "left", "left", "right", "right", "right"],
      body: orders.map((o) => [formatDate(o.createdAt), o.restaurantName, o.plateTitle, num(o.quantity), num(o.mealsDelivered ?? 0), money(o.total)]),
      foot: [["Total", "", "", num(mealCount), num(delivered), money(total)]],
    });
  } else r.empty("No contributions.");

  r.note(
    `Thank you, ${donor.name.split(" ")[0]}. Your gifts in ${year} provided ${num(mealCount)} free meals to community members through ` +
      `Waste Not Kitchen. No goods or services were provided to you in exchange for these contributions. Keep this ` +
      `receipt for your records and consult a tax professional about deductibility.`,
  );
  return r.finish();
}

// ---------- Community member meal history ----------

export function communityReport(input: { member: UserProfile; year: number; meals: Meal[] }): jsPDF {
  const { member, year } = input;
  const received = input.meals.filter((m) => m.status === "picked_up");
  const b = monthly(year);

  const r = new Report("Community Meals Summary");
  r.header({
    kicker: "Community meals summary",
    title: member.name,
    meta: [
      ["Year", String(year)],
      ["Member since", formatDate(member.createdAt, { month: "short", year: "numeric" })],
    ],
    subtitle: member.address,
  });
  r.kpis([
    { label: "Meals received", value: num(received.length) },
    { label: "Meals claimed", value: num(input.meals.length) },
    { label: "Value of meals", value: money(sum(received, (m) => m.value)) },
    { label: "Restaurants visited", value: num(new Set(received.map((m) => m.restaurantId)).size) },
  ]);
  r.section("Meals received by month", String(year), 230);
  if (received.length) {
    r.columns({ labels: b.labels, series: [{ name: "Meals", color: palette.series[2], values: series(received, b, (m) => toDate(m.pickedUpAt ?? m.claimedAt), () => 1) }] });
  } else r.empty(`No meals received in ${year}.`);
  r.section("Meal history");
  if (input.meals.length) {
    r.table({
      head: ["Claimed", "Restaurant", "Meal", "Status", "Value"],
      align: ["left", "left", "left", "left", "right"],
      body: input.meals.map((m) => [
        formatDate(m.claimedAt),
        m.restaurantName,
        m.plateTitle,
        { picked_up: "Received", claimed: "Awaiting pickup", expired: "Not collected", available: "Released" }[m.status],
        money(m.value),
      ]),
    });
  } else r.empty("No meals claimed.");
  return r.finish();
}
