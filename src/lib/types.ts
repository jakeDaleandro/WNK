import type { Timestamp } from "firebase/firestore";

export type Role = "restaurant" | "customer" | "donor" | "needy" | "admin";
export type Category = "entree" | "bakery" | "produce" | "dessert" | "mealkit" | "beverage" | "other";
export type Dietary = "vegetarian" | "vegan" | "gluten-free" | "dairy-free" | "nut-free" | "halal";
export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "card";

export interface PaymentSnapshot {
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  holder: string;
}

export interface UserProfile {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone?: string | null;
  address: string;
  status: "active" | "suspended";
  payment?: PaymentSnapshot;
  restaurant?: { cuisine?: string; description?: string; hours?: string };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Plate {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  title: string;
  description: string;
  category: Category;
  dietary: Dietary[];
  price: number;
  originalPrice: number | null;
  quantity: number;
  reserved: number;
  expiresAt: Timestamp;
  status: "active" | "withdrawn";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OrderStatus = "reserved" | "confirmed" | "picked_up" | "cancelled" | "expired";

export interface Order {
  id: string;
  type: "purchase" | "donation";
  status: OrderStatus;
  userId: string;
  userName: string;
  plateId: string;
  plateTitle: string;
  category: Category;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  quantity: number;
  unitPrice: number;
  originalPrice: number | null;
  total: number;
  pickupCode: string | null;
  expiresAt: Timestamp;
  payment: { brand: CardBrand; last4: string };
  mealsClaimed: number;
  mealsDelivered: number;
  createdAt: Timestamp | null;
  pickedUpAt: Timestamp | null;
  cancelledAt: Timestamp | null;
}

export type MealStatus = "available" | "claimed" | "picked_up" | "expired";

export interface Meal {
  id: string;
  donationId: string;
  donorId: string;
  plateId: string;
  plateTitle: string;
  description: string;
  category: Category;
  dietary: Dietary[];
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  value: number;
  expiresAt: Timestamp;
  status: MealStatus;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: Timestamp | null;
  pickupCode: string | null;
  pickedUpAt: Timestamp | null;
  createdAt: Timestamp | null;
}

export interface PublicStats {
  mealsRescued?: number;
  mealsDonated?: number;
  mealsDelivered?: number;
  members?: number;
  restaurants?: number;
}
