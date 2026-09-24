import {
  Apple,
  Cake,
  Coffee,
  Croissant,
  HandHeart,
  Package,
  ShieldCheck,
  ShoppingBag,
  Soup,
  Store,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Category, Dietary, MealStatus, OrderStatus, Role } from "./types";

export const categories: Record<Category, { label: string; icon: LucideIcon; tint: string; ink: string }> = {
  entree: { label: "Entrées", icon: UtensilsCrossed, tint: "from-emerald-100 to-emerald-50", ink: "text-emerald-700" },
  bakery: { label: "Bakery", icon: Croissant, tint: "from-amber-100 to-amber-50", ink: "text-amber-700" },
  produce: { label: "Produce", icon: Apple, tint: "from-lime-100 to-lime-50", ink: "text-lime-700" },
  dessert: { label: "Desserts", icon: Cake, tint: "from-rose-100 to-rose-50", ink: "text-rose-700" },
  mealkit: { label: "Meal kits", icon: Package, tint: "from-sky-100 to-sky-50", ink: "text-sky-700" },
  beverage: { label: "Drinks", icon: Coffee, tint: "from-orange-100 to-orange-50", ink: "text-orange-700" },
  other: { label: "Other", icon: Soup, tint: "from-stone-200 to-stone-50", ink: "text-stone-700" },
};

export const categoryOrder = Object.keys(categories) as Category[];

export const dietaryLabels: Record<Dietary, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  "nut-free": "Nut-free",
  halal: "Halal",
};

export const dietaryOrder = Object.keys(dietaryLabels) as Dietary[];

export const roles: Record<Role, { label: string; noun: string; icon: LucideIcon; blurb: string }> = {
  customer: {
    label: "Customer",
    noun: "customers",
    icon: ShoppingBag,
    blurb: "Pick up great food from local kitchens at a fraction of the price.",
  },
  donor: {
    label: "Donor",
    noun: "donors",
    icon: HandHeart,
    blurb: "Buy surplus meals for neighbors in need, with year-end tax receipts.",
  },
  restaurant: {
    label: "Restaurant",
    noun: "restaurants",
    icon: Store,
    blurb: "List surplus food in seconds, recover costs, and cut waste.",
  },
  needy: {
    label: "Community member",
    noun: "community members",
    icon: Users,
    blurb: "Claim free meals donated by your community, no questions asked.",
  },
  admin: {
    label: "Administrator",
    noun: "administrators",
    icon: ShieldCheck,
    blurb: "Oversee members, activity, and reporting.",
  },
};

type Tone = "green" | "amber" | "blue" | "red" | "gray" | "violet";

export const orderStatus: Record<OrderStatus, { label: string; tone: Tone }> = {
  reserved: { label: "Ready for pickup", tone: "amber" },
  confirmed: { label: "Donated", tone: "violet" },
  picked_up: { label: "Picked up", tone: "green" },
  cancelled: { label: "Cancelled", tone: "gray" },
  expired: { label: "Expired", tone: "red" },
};

export const mealStatus: Record<MealStatus, { label: string; tone: Tone }> = {
  available: { label: "Waiting for a neighbor", tone: "blue" },
  claimed: { label: "Claimed", tone: "amber" },
  picked_up: { label: "Delivered", tone: "green" },
  expired: { label: "Expired", tone: "red" },
};

export type { Tone };
