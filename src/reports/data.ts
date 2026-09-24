import { collection, getDocs, orderBy, query, Timestamp, where, type Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toDate } from "@/lib/format";
import type { Meal, Order, UserProfile } from "@/lib/types";

async function all<T>(q: Query): Promise<T[]> {
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as T);
}

const inYear = (year: number) => (d: Date | null) => !!d && d.getFullYear() === year;

export async function loadPlatform(from: Date, to: Date) {
  const range = (c: string) =>
    query(
      collection(db, c),
      where("createdAt", ">=", Timestamp.fromDate(from)),
      where("createdAt", "<=", Timestamp.fromDate(to)),
      orderBy("createdAt", "asc"),
    );
  const [orders, meals, users] = await Promise.all([
    all<Order>(range("orders")),
    all<Meal>(range("meals")),
    all<UserProfile>(collection(db, "users")),
  ]);
  return { orders, meals, users };
}

export async function loadRestaurant(id: string, year: number) {
  const y = inYear(year);
  const [orders, meals] = await Promise.all([
    all<Order>(query(collection(db, "orders"), where("restaurantId", "==", id))),
    all<Meal>(query(collection(db, "meals"), where("restaurantId", "==", id))),
  ]);
  return {
    orders: orders.filter((o) => y(toDate(o.createdAt))).sort(byCreated),
    meals: meals.filter((m) => y(toDate(m.createdAt))),
  };
}

export async function loadCustomer(id: string, year: number) {
  const orders = await all<Order>(query(collection(db, "orders"), where("userId", "==", id)));
  return { orders: orders.filter((o) => inYear(year)(toDate(o.createdAt))).sort(byCreated) };
}

export async function loadDonor(id: string, year: number) {
  const y = inYear(year);
  const [orders, meals] = await Promise.all([
    all<Order>(query(collection(db, "orders"), where("userId", "==", id))),
    all<Meal>(query(collection(db, "meals"), where("donorId", "==", id))),
  ]);
  return {
    orders: orders.filter((o) => y(toDate(o.createdAt))).sort(byCreated),
    meals: meals.filter((m) => y(toDate(m.createdAt))),
  };
}

export async function loadCommunityMember(id: string, year: number) {
  const meals = await all<Meal>(query(collection(db, "meals"), where("claimedBy", "==", id)));
  return {
    meals: meals
      .filter((m) => inYear(year)(toDate(m.claimedAt)))
      .sort((a, b) => (toDate(a.claimedAt)?.getTime() ?? 0) - (toDate(b.claimedAt)?.getTime() ?? 0)),
  };
}

function byCreated(a: Order, b: Order) {
  return (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0);
}
