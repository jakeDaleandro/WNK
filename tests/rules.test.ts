import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

const payment = { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030, holder: "Test User" };
const base = (role: string, email: string, extra: Record<string, unknown> = {}) => ({
  role,
  name: `${role} user`,
  email,
  phone: "555-123-4567",
  address: "123 Main Street",
  status: "active",
  createdAt: serverTimestamp(),
  ...extra,
});

const inHours = (h: number) => Timestamp.fromMillis(Date.now() + h * 3600_000);

function plate(rid: string, extra: Record<string, unknown> = {}) {
  return {
    restaurantId: rid,
    restaurantName: "Resto",
    restaurantAddress: "1 Food St",
    title: "Lasagna",
    description: "Tasty",
    category: "entree",
    dietary: ["vegetarian"],
    price: 5,
    originalPrice: 12,
    quantity: 5,
    reserved: 0,
    expiresAt: inHours(3),
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

const as = (uid: string, email = `${uid}@test.dev`) => env.authenticatedContext(uid, { email }).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "wnk-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();
    const seed: Record<string, Record<string, unknown>> = {
      resto: { ...base("restaurant", "resto@test.dev"), name: "Resto", address: "1 Food St", createdAt: now },
      resto2: { ...base("restaurant", "resto2@test.dev"), name: "Other", address: "2 Food St", createdAt: now },
      cust: { ...base("customer", "cust@test.dev", { payment }), createdAt: now },
      needy: { ...base("needy", "needy@test.dev"), createdAt: now },
      needy2: { ...base("needy", "needy2@test.dev"), createdAt: now },
      admin: { ...base("admin", "admin@test.dev"), createdAt: now },
      banned: { ...base("customer", "banned@test.dev", { payment }), status: "suspended", createdAt: now },
    };
    for (const [id, data] of Object.entries(seed)) await setDoc(doc(db, "users", id), data);
    await setDoc(doc(db, "plates", "p1"), { ...plate("resto"), createdAt: now, updatedAt: now });
    await setDoc(doc(db, "orders", "o1"), { userId: "cust", restaurantId: "resto", status: "reserved", total: 5 });
    await setDoc(doc(db, "meals", "m-open"), { restaurantId: "resto", donorId: "donor", status: "available", claimedBy: null });
    await setDoc(doc(db, "meals", "m-claimed"), { restaurantId: "resto", donorId: "donor", status: "claimed", claimedBy: "needy2" });
    await setDoc(doc(db, "stats", "global"), { mealsRescued: 10 });
  });
});

describe("users", () => {
  it("lets a new user create their own customer profile", async () => {
    await assertSucceeds(setDoc(doc(as("new"), "users", "new"), base("customer", "new@test.dev", { payment })));
  });

  it("blocks self-assigning the admin role", async () => {
    await assertFails(setDoc(doc(as("new"), "users", "new"), base("admin", "new@test.dev")));
  });

  it("blocks creating a profile for someone else", async () => {
    await assertFails(setDoc(doc(as("new"), "users", "victim"), base("customer", "new@test.dev", { payment })));
  });

  it("rejects full card numbers or CVVs", async () => {
    await assertFails(
      setDoc(doc(as("new"), "users", "new"), base("customer", "new@test.dev", { payment: { ...payment, number: "4242424242424242" } })),
    );
    await assertFails(
      setDoc(doc(as("new"), "users", "new"), base("customer", "new@test.dev", { payment: { ...payment, cvv: "123" } })),
    );
  });

  it("requires payment for customers and forbids it for restaurants", async () => {
    await assertFails(setDoc(doc(as("new"), "users", "new"), base("customer", "new@test.dev")));
    await assertFails(setDoc(doc(as("new"), "users", "new"), base("restaurant", "new@test.dev", { payment })));
  });

  it("requires the profile email to match the signed-in account", async () => {
    await assertFails(setDoc(doc(as("new"), "users", "new"), base("needy", "someone-else@test.dev")));
  });

  it("blocks privilege escalation and self-unsuspension", async () => {
    await assertFails(updateDoc(doc(as("cust", "cust@test.dev"), "users", "cust"), { role: "admin", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as("banned", "banned@test.dev"), "users", "banned"), { status: "active", updatedAt: serverTimestamp() }));
  });

  it("allows editing own contact details", async () => {
    await assertSucceeds(updateDoc(doc(as("cust", "cust@test.dev"), "users", "cust"), { phone: "555-999-0000", updatedAt: serverTimestamp() }));
  });

  it("keeps profiles private except to admins", async () => {
    await assertFails(getDoc(doc(as("cust"), "users", "resto")));
    await assertSucceeds(getDoc(doc(as("admin"), "users", "resto")));
    await assertSucceeds(getDocs(collection(as("admin"), "users")));
    await assertFails(getDocs(collection(as("cust"), "users")));
  });
});

describe("plates", () => {
  it("lets restaurants publish their own listings", async () => {
    await assertSucceeds(setDoc(doc(as("resto"), "plates", "new"), plate("resto")));
  });

  it("blocks non-restaurants and impersonation", async () => {
    await assertFails(setDoc(doc(as("cust"), "plates", "new"), plate("cust")));
    await assertFails(setDoc(doc(as("resto2"), "plates", "new"), plate("resto")));
    await assertFails(setDoc(doc(as("resto"), "plates", "new"), plate("resto", { restaurantName: "Fake Name" })));
  });

  it("blocks pre-sold inventory and bad values", async () => {
    await assertFails(setDoc(doc(as("resto"), "plates", "new"), plate("resto", { reserved: 2 })));
    await assertFails(setDoc(doc(as("resto"), "plates", "new"), plate("resto", { price: -1 })));
    await assertFails(setDoc(doc(as("resto"), "plates", "new"), plate("resto", { expiresAt: inHours(-1) })));
    await assertFails(setDoc(doc(as("resto"), "plates", "new"), plate("resto", { expiresAt: inHours(24 * 30) })));
  });

  it("never lets clients touch the reserved counter or undersell it", async () => {
    await assertFails(updateDoc(doc(as("resto"), "plates", "p1"), { reserved: 3, updatedAt: serverTimestamp() }));
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "plates", "p1"), { reserved: 4 }));
    await assertFails(updateDoc(doc(as("resto"), "plates", "p1"), { quantity: 3, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as("resto"), "plates", "p1")));
  });

  it("lets the owner edit details but not another restaurant", async () => {
    await assertSucceeds(updateDoc(doc(as("resto"), "plates", "p1"), { price: 4, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as("resto2"), "plates", "p1"), { price: 1, updatedAt: serverTimestamp() }));
  });

  it("is readable by active members only", async () => {
    await assertSucceeds(getDoc(doc(as("cust"), "plates", "p1")));
    await assertFails(getDoc(doc(as("banned"), "plates", "p1")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "plates", "p1")));
  });

  it("prevents deleting a listing another restaurant owns", async () => {
    await assertFails(deleteDoc(doc(as("resto2"), "plates", "p1")));
    await assertSucceeds(deleteDoc(doc(as("resto"), "plates", "p1")));
  });
});

describe("orders & meals", () => {
  it("are never client-writable", async () => {
    await assertFails(setDoc(doc(as("cust"), "orders", "forged"), { userId: "cust", restaurantId: "resto", status: "picked_up" }));
    await assertFails(updateDoc(doc(as("resto"), "orders", "o1"), { status: "picked_up" }));
    await assertFails(updateDoc(doc(as("needy"), "meals", "m-open"), { status: "claimed", claimedBy: "needy" }));
  });

  it("orders are visible to the buyer, the restaurant and admins only", async () => {
    await assertSucceeds(getDoc(doc(as("cust"), "orders", "o1")));
    await assertSucceeds(getDoc(doc(as("resto"), "orders", "o1")));
    await assertSucceeds(getDoc(doc(as("admin"), "orders", "o1")));
    await assertFails(getDoc(doc(as("resto2"), "orders", "o1")));
    await assertFails(getDoc(doc(as("needy"), "orders", "o1")));
  });

  it("community members see available meals and their own claims only", async () => {
    await assertSucceeds(getDocs(query(collection(as("needy"), "meals"), where("status", "==", "available"))));
    await assertFails(getDoc(doc(as("needy"), "meals", "m-claimed")));
    await assertSucceeds(getDoc(doc(as("needy2"), "meals", "m-claimed")));
    await assertFails(getDocs(query(collection(as("cust"), "meals"), where("status", "==", "available"))));
  });
});

describe("stats", () => {
  it("are public to read and closed to write", async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), "stats", "global")));
    await assertFails(setDoc(doc(as("admin"), "stats", "global"), { mealsRescued: 1e9 }));
  });
});
