/**
 * Seeds the local Firebase emulators with realistic demo data:
 * members of every type, live listings, and ~60 days of order history.
 *
 *   npm run emulators        # in one terminal
 *   npm run seed             # in another
 *
 * Refuses to run against production.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8081";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
if (!process.env.FIRESTORE_EMULATOR_HOST.startsWith("127.0.0.1") && !process.env.FIRESTORE_EMULATOR_HOST.startsWith("localhost")) {
  console.error("Refusing to seed: FIRESTORE_EMULATOR_HOST is not local.");
  process.exit(1);
}

initializeApp({ projectId: "wnkk-9486c" });
const db = getFirestore();
const auth = getAuth();

const PASSWORD = "password123";
const H = 3600_000;
const D = 24 * H;
const now = Date.now();
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from({ length: 6 }, () => CODE[Math.floor(rand() * CODE.length)]).join("");
const ts = (ms) => Timestamp.fromMillis(ms);

const people = [
  { key: "admin", role: "admin", name: "Avery Admin", email: "admin@wnk.test", phone: "555-010-0000", address: "1 Civic Plaza, Orlando, FL" },
  { key: "pasta", role: "restaurant", name: "Pasta Palace", email: "pasta@wnk.test", phone: "555-010-1111", address: "100 Noodle Rd, Orlando, FL", restaurant: { cuisine: "Italian" } },
  { key: "tacos", role: "restaurant", name: "Tasty Tacos", email: "tacos@wnk.test", phone: "555-010-2222", address: "200 Taco Ave, Orlando, FL", restaurant: { cuisine: "Mexican" } },
  { key: "crumb", role: "restaurant", name: "Crumb & Co. Bakery", email: "bakery@wnk.test", phone: "555-010-3333", address: "300 Flour St, Orlando, FL", restaurant: { cuisine: "Bakery" } },
  { key: "green", role: "restaurant", name: "Green Bowl Kitchen", email: "green@wnk.test", phone: "555-010-4444", address: "400 Kale Ct, Orlando, FL", restaurant: { cuisine: "Healthy" } },
  { key: "c1", role: "customer", name: "Jordan Rivera", email: "customer@wnk.test", phone: "555-020-1111", address: "12 Lake Dr, Orlando, FL", payment: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2029, holder: "Jordan Rivera" } },
  { key: "c2", role: "customer", name: "Sam Patel", email: "sam@wnk.test", phone: "555-020-2222", address: "88 Pine St, Orlando, FL", payment: { brand: "mastercard", last4: "4444", expMonth: 8, expYear: 2028, holder: "Sam Patel" } },
  { key: "d1", role: "donor", name: "Daisy Donor", email: "donor@wnk.test", phone: "555-030-1111", address: "500 Help St, Orlando, FL", payment: { brand: "amex", last4: "0005", expMonth: 3, expYear: 2030, holder: "Daisy Donor" } },
  { key: "d2", role: "donor", name: "Marcus Chen", email: "marcus@wnk.test", phone: "555-030-2222", address: "9 Oak Ln, Orlando, FL", payment: { brand: "visa", last4: "1881", expMonth: 5, expYear: 2029, holder: "Marcus Chen" } },
  { key: "n1", role: "needy", name: "Nancy Neighbor", email: "needy@wnk.test", phone: null, address: "600 Support Ln, Orlando, FL" },
  { key: "n2", role: "needy", name: "Luis Gomez", email: "luis@wnk.test", phone: "555-040-2222", address: "14 Elm St, Orlando, FL" },
];

const menu = {
  pasta: [
    ["Baked ziti tray", "entree", 6, 16, ["vegetarian"], "Ziti baked with ricotta, mozzarella and house marinara. Serves one generously."],
    ["Chicken parm dinner", "entree", 7, 19, [], "Breaded chicken, marinara and provolone over spaghetti."],
    ["Tiramisu slice", "dessert", 3, 8, ["vegetarian"], "Espresso-soaked ladyfingers and mascarpone."],
  ],
  tacos: [
    ["Street taco trio", "entree", 5, 13, ["gluten-free", "dairy-free"], "Al pastor, carnitas and pollo on corn tortillas."],
    ["Veggie burrito bowl", "entree", 5, 12, ["vegan", "gluten-free"], "Cilantro rice, black beans, fajita veggies, salsa verde."],
    ["Horchata (32 oz)", "beverage", 2, 5, ["vegetarian", "gluten-free"], "Cinnamon rice milk, made this morning."],
  ],
  crumb: [
    ["Morning pastry box", "bakery", 5, 16, ["vegetarian"], "Six assorted croissants, danishes and muffins from today's bake."],
    ["Sourdough loaf", "bakery", 3, 9, ["vegan", "dairy-free"], "Naturally leavened country loaf."],
    ["Cookie dozen", "dessert", 4, 14, ["vegetarian"], "Chocolate chip, oatmeal raisin and snickerdoodle."],
  ],
  green: [
    ["Harvest grain bowl", "entree", 5, 14, ["vegan", "dairy-free"], "Farro, roasted squash, kale, pickled onion, tahini."],
    ["Seasonal produce box", "produce", 6, 18, ["vegan", "gluten-free"], "About 5 lb of farm-fresh produce we won't get to."],
    ["Cold-pressed juice", "beverage", 3, 8, ["vegan", "gluten-free", "nut-free"], "Green apple, cucumber, spinach, ginger."],
  ],
};

async function clear() {
  for (const c of ["users", "plates", "orders", "meals", "stats"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const list = await auth.listUsers();
  if (list.users.length) await auth.deleteUsers(list.users.map((u) => u.uid));
}

async function main() {
  await clear();
  const uid = {};
  const profile = {};
  for (const p of people) {
    const user = await auth.createUser({ email: p.email, password: PASSWORD, displayName: p.name });
    uid[p.key] = user.uid;
    const { key, ...rest } = p;
    const created = ts(now - (70 + Math.floor(rand() * 40)) * D + Math.floor(rand() * D));
    profile[key] = { ...rest, status: "active", createdAt: created };
    await db.doc(`users/${user.uid}`).set(profile[key]);
  }

  const batch = [];
  let stats = { mealsRescued: 0, mealsDonated: 0, mealsDelivered: 0, members: people.length, restaurants: 4 };
  const restaurants = ["pasta", "tacos", "crumb", "green"];
  const customers = ["c1", "c2"];
  const donors = ["d1", "d2"];
  const needy = ["n1", "n2"];

  // Historical listings + orders over the last 60 days.
  for (let day = 60; day >= 1; day--) {
    for (const r of restaurants) {
      if (rand() < 0.35) continue;
      const [title, category, price, originalPrice, dietary, description] = pick(menu[r]);
      const created = now - day * D + (14 + rand() * 4) * H;
      const expires = created + (3 + rand() * 3) * H;
      const quantity = 4 + Math.floor(rand() * 8);
      const plateRef = db.collection("plates").doc();
      let reserved = 0;
      const nOrders = Math.floor(rand() * 4);
      for (let i = 0; i < nOrders && reserved < quantity; i++) {
        const donation = rand() < 0.35;
        const buyer = donation ? pick(donors) : pick(customers);
        const qty = Math.min(1 + Math.floor(rand() * 3), quantity - reserved);
        reserved += qty;
        const at = created + rand() * (expires - created - H);
        const orderRef = db.collection("orders").doc();
        const cancelled = !donation && rand() < 0.08;
        const expired = !donation && !cancelled && rand() < 0.1;
        let delivered = 0;
        let claimed = 0;
        if (donation) {
          for (let m = 0; m < qty; m++) {
            const outcome = rand();
            const status = outcome < 0.7 ? "picked_up" : "expired";
            const who = pick(needy);
            if (status === "picked_up") { delivered++; claimed++; }
            batch.push([db.collection("meals").doc(), {
              donationId: orderRef.id, donorId: uid[buyer], plateId: plateRef.id, plateTitle: title, description, category, dietary,
              restaurantId: uid[r], restaurantName: profile[r].name, restaurantAddress: profile[r].address, value: price,
              expiresAt: ts(expires), status,
              claimedBy: status === "picked_up" ? uid[who] : null, claimedByName: status === "picked_up" ? profile[who].name : null,
              claimedAt: status === "picked_up" ? ts(at + H) : null, pickupCode: status === "picked_up" ? code() : null,
              pickedUpAt: status === "picked_up" ? ts(at + 2 * H) : null, createdAt: ts(at),
            }]);
          }
        }
        const status = donation ? "confirmed" : cancelled ? "cancelled" : expired ? "expired" : "picked_up";
        if (!cancelled) stats.mealsRescued += qty;
        if (donation) stats.mealsDonated += qty;
        stats.mealsDelivered += delivered;
        batch.push([orderRef, {
          type: donation ? "donation" : "purchase", status, userId: uid[buyer], userName: profile[buyer].name,
          plateId: plateRef.id, plateTitle: title, category, restaurantId: uid[r], restaurantName: profile[r].name,
          restaurantAddress: profile[r].address, quantity: qty, unitPrice: price, originalPrice, total: Math.round(price * qty * 100) / 100,
          pickupCode: donation ? null : code(), expiresAt: ts(expires),
          payment: { brand: profile[buyer].payment.brand, last4: profile[buyer].payment.last4 },
          mealsClaimed: claimed, mealsDelivered: delivered, createdAt: ts(at),
          pickedUpAt: status === "picked_up" ? ts(at + H) : null, cancelledAt: cancelled ? ts(at + H / 2) : null,
        }]);
      }
      batch.push([plateRef, {
        restaurantId: uid[r], restaurantName: profile[r].name, restaurantAddress: profile[r].address,
        title, description, category, dietary, price, originalPrice, quantity, reserved: Math.min(reserved, quantity),
        expiresAt: ts(expires), status: "active", createdAt: ts(created), updatedAt: ts(created),
      }]);
    }
  }

  // Live listings for right now.
  for (const r of restaurants) {
    for (const [title, category, price, originalPrice, dietary, description] of menu[r].slice(0, 2)) {
      batch.push([db.collection("plates").doc(), {
        restaurantId: uid[r], restaurantName: profile[r].name, restaurantAddress: profile[r].address,
        title, description, category, dietary, price, originalPrice, quantity: 6 + Math.floor(rand() * 6), reserved: 0,
        expiresAt: ts(now + (1 + rand() * 5) * H), status: "active", createdAt: ts(now - H), updatedAt: ts(now - H),
      }]);
    }
  }

  for (let i = 0; i < batch.length; i += 400) {
    const b = db.batch();
    batch.slice(i, i + 400).forEach(([ref, data]) => b.set(ref, data));
    await b.commit();
  }
  await db.doc("stats/global").set({ ...stats, updatedAt: FieldValue.serverTimestamp() });

  console.log(`Seeded ${people.length} members and ${batch.length} documents.`);
  console.log(`Sign in with any of these (password: ${PASSWORD}):`);
  for (const p of people) console.log(`  ${p.role.padEnd(10)} ${p.email}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
