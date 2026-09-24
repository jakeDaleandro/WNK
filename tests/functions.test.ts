/**
 * End-to-end tests of the Cloud Functions against the local emulators, using
 * the real client SDK exactly as the web app does.
 *
 *   npm run test:functions
 */
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getFirestore as adminDb } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PROJECT = "wnkk-9486c";
const apps: FirebaseApp[] = [];
const admin = adminDb(initAdmin({ projectId: PROJECT }, "admin"));
const run = Math.random().toString(36).slice(2, 8);
const payment = { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030, holder: "Test" };

async function member(role: string, extra: Record<string, unknown> = {}) {
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT }, `${role}-${apps.length}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8081);
  const fns = getFunctions(app, "us-central1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);

  const email = `${role}-${apps.length}-${run}@test.dev`;
  const { user } = await createUserWithEmailAndPassword(auth, email, "password123");
  const name = `${role} ${apps.length}`;
  await setDoc(doc(db, "users", user.uid), {
    role,
    name,
    email,
    phone: "555-000-1234",
    address: "1 Test Street",
    status: "active",
    createdAt: serverTimestamp(),
    ...(role === "customer" || role === "donor" ? { payment } : {}),
    ...extra,
  });
  const call = <T = unknown>(fn: string, data: unknown) => httpsCallable<unknown, T>(fns, fn)(data).then((r) => r.data);
  return { uid: user.uid, db, call, name, address: "1 Test Street" };
}

let resto: Awaited<ReturnType<typeof member>>;
let cust: Awaited<ReturnType<typeof member>>;
let donor: Awaited<ReturnType<typeof member>>;
let needy: Awaited<ReturnType<typeof member>>;
let plateId: string;

beforeAll(async () => {
  [resto, cust, donor, needy] = await Promise.all([member("restaurant"), member("customer"), member("donor"), member("needy")]);
  const ref = await addDoc(collection(resto.db, "plates"), {
    restaurantId: resto.uid,
    restaurantName: resto.name,
    restaurantAddress: resto.address,
    title: "Test lasagna",
    description: "",
    category: "entree",
    dietary: [],
    price: 4.5,
    originalPrice: 12,
    quantity: 6,
    reserved: 0,
    expiresAt: Timestamp.fromMillis(Date.now() + 3 * 3600_000),
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  plateId = ref.id;
}, 60_000);

afterAll(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)));
});

const reserved = async () => (await admin.doc(`plates/${plateId}`).get()).data()!.reserved;

describe("ordering", () => {
  let code: string;
  let orderId: string;

  it("reserves a plate and returns a pickup code", async () => {
    const res = await cust.call<{ orderId: string; pickupCode: string; total: number }>("placeOrder", { plateId, quantity: 2, type: "purchase" });
    expect(res.pickupCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(res.total).toBe(9);
    expect(await reserved()).toBe(2);
    code = res.pickupCode;
    orderId = res.orderId;
  });

  it("rejects the wrong order type for a role", async () => {
    await expect(cust.call("placeOrder", { plateId, quantity: 1, type: "donation" })).rejects.toThrow(/account type/);
    await expect(needy.call("placeOrder", { plateId, quantity: 1, type: "purchase" })).rejects.toThrow(/account type/);
  });

  it("never oversells", async () => {
    await expect(cust.call("placeOrder", { plateId, quantity: 5, type: "purchase" })).rejects.toThrow(/Only 4 left/);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => cust.call("placeOrder", { plateId, quantity: 1, type: "purchase" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);
    expect(await reserved()).toBe(6);
  });

  it("releases inventory on cancel", async () => {
    await cust.call("cancelOrder", { orderId });
    expect(await reserved()).toBe(4);
    await expect(cust.call("cancelOrder", { orderId })).rejects.toThrow(/Only active reservations/);
  });

  it("only the restaurant can confirm, and only with the right code", async () => {
    const res = await cust.call<{ pickupCode: string }>("placeOrder", { plateId, quantity: 1, type: "purchase" });
    await expect(resto.call("confirmPickup", { code: "ZZZZZZ" })).rejects.toThrow(/No open pickup/);
    await expect(cust.call("confirmPickup", { code: res.pickupCode })).rejects.toThrow(/account type/);
    await expect(resto.call("confirmPickup", { code })).rejects.toThrow(/No open pickup/); // cancelled order
    const ok = await resto.call<{ kind: string }>("confirmPickup", { code: res.pickupCode.toLowerCase() });
    expect(ok.kind).toBe("purchase");
    await expect(resto.call("confirmPickup", { code: res.pickupCode })).rejects.toThrow(/No open pickup/);
  });
});

describe("donations & community meals", () => {
  let meals: string[];

  it("turns a donation into individual claimable meals", async () => {
    await admin.doc(`plates/${plateId}`).update({ quantity: 20 });
    const res = await donor.call<{ orderId: string }>("placeOrder", { plateId, quantity: 3, type: "donation" });
    const snap = await getDocs(query(collection(donor.db, "meals"), where("donorId", "==", donor.uid)));
    expect(snap.size).toBe(3);
    expect(snap.docs.every((d) => d.data().donationId === res.orderId && d.data().status === "available")).toBe(true);
    meals = snap.docs.map((d) => d.id);
  });

  it("limits community members to two active claims", async () => {
    const a = await needy.call<{ pickupCode: string }>("claimMeal", { mealId: meals[0] });
    await needy.call("claimMeal", { mealId: meals[1] });
    await expect(needy.call("claimMeal", { mealId: meals[2] })).rejects.toThrow(/up to 2 meals/);

    // Restaurant confirms one; the member can then claim again.
    const done = await resto.call<{ kind: string }>("confirmPickup", { code: a.pickupCode });
    expect(done.kind).toBe("meal");
    await needy.call("claimMeal", { mealId: meals[2] });

    const donation = (await getDocs(query(collection(donor.db, "orders"), where("userId", "==", donor.uid)))).docs[0].data();
    expect(donation.mealsClaimed).toBe(3);
    expect(donation.mealsDelivered).toBe(1);
  });

  it("lets a member release a claim back to the pool", async () => {
    await needy.call("releaseMeal", { mealId: meals[2] });
    const m = await getDoc(doc(needy.db, "meals", meals[2]));
    expect(m.data()?.status).toBe("available");
    await expect(needy.call("releaseMeal", { mealId: meals[2] })).rejects.toThrow(/isn't currently claimed/);
  });

  it("keeps public impact stats in sync", async () => {
    const stats = (await admin.doc("stats/global").get()).data()!;
    expect(stats.mealsDonated).toBeGreaterThanOrEqual(3);
    expect(stats.mealsDelivered).toBeGreaterThanOrEqual(1);
  });
});

describe("administration", () => {
  it("only admins can suspend, and suspension locks the account out", async () => {
    await expect(cust.call("setUserStatus", { uid: donor.uid, status: "suspended" })).rejects.toThrow(/account type/);
    const boss = await member("needy");
    await admin.doc(`users/${boss.uid}`).update({ role: "admin" });
    await boss.call("setUserStatus", { uid: donor.uid, status: "suspended" });
    await expect(donor.call("placeOrder", { plateId, quantity: 1, type: "donation" })).rejects.toThrow();
    await boss.call("setUserStatus", { uid: donor.uid, status: "active" });
  });
});
