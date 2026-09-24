/**
 * Waste Not Kitchen — Cloud Functions
 *
 * Every state change that involves money, inventory, or pickup verification
 * runs here inside a Firestore transaction, so clients can never oversell a
 * plate, claim more than their share, or mark their own order as picked up.
 */
import { randomInt } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Transaction,
} from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const db = getFirestore();
const statsRef = db.doc("stats/global");

type Role = "restaurant" | "customer" | "donor" | "needy" | "admin";

const MAX_ACTIVE_CLAIMS = 2;
const MAX_ORDER_QUANTITY = 10;
const PICKUP_GRACE_MS = 2 * 60 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ---------- helpers ----------

function pickupCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function requireString(value: unknown, field: string, max = 128): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new HttpsError("invalid-argument", `"${field}" is required.`);
  }
  return value.trim();
}

/** Loads the caller's profile and checks that the account is active and has one of `roles`. */
async function requireUser(req: CallableRequest, roles: Role[]) {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please sign in to continue.");

  const snap = await db.doc(`users/${uid}`).get();
  const profile = snap.data();
  if (!profile) throw new HttpsError("failed-precondition", "Finish setting up your profile first.");
  if (profile.status !== "active") {
    throw new HttpsError("permission-denied", "This account is suspended. Contact support for help.");
  }
  if (!roles.includes(profile.role)) {
    throw new HttpsError("permission-denied", "Your account type can't perform this action.");
  }
  return { uid, profile };
}

function bumpStats(tx: Transaction, fields: Record<string, number>) {
  const update: DocumentData = { updatedAt: FieldValue.serverTimestamp() };
  for (const [key, delta] of Object.entries(fields)) update[key] = FieldValue.increment(delta);
  tx.set(statsRef, update, { merge: true });
}

// ---------- ordering ----------

/**
 * Customers purchase plates for pickup; donors purchase plates that become
 * individual free meals for community members.
 */
export const placeOrder = onCall(async (req) => {
  const type = req.data?.type;
  if (type !== "purchase" && type !== "donation") {
    throw new HttpsError("invalid-argument", "Unknown order type.");
  }
  const { uid, profile } = await requireUser(req, [type === "purchase" ? "customer" : "donor"]);

  const plateId = requireString(req.data?.plateId, "plateId");
  const quantity = Number(req.data?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
    throw new HttpsError("invalid-argument", `Quantity must be between 1 and ${MAX_ORDER_QUANTITY}.`);
  }
  if (!profile.payment?.last4) {
    throw new HttpsError("failed-precondition", "Add a payment method in Account settings first.");
  }

  const plateRef = db.doc(`plates/${plateId}`);
  const orderRef = db.collection("orders").doc();

  const result = await db.runTransaction(async (tx) => {
    const plateSnap = await tx.get(plateRef);
    const plate = plateSnap.data();
    if (!plate || plate.status !== "active") {
      throw new HttpsError("not-found", "This listing is no longer available.");
    }
    if ((plate.expiresAt as Timestamp).toMillis() <= Date.now()) {
      throw new HttpsError("failed-precondition", "The pickup window for this listing has closed.");
    }
    const available = plate.quantity - plate.reserved;
    if (available < quantity) {
      throw new HttpsError(
        "resource-exhausted",
        available > 0 ? `Only ${available} left — lower the quantity and try again.` : "This listing just sold out.",
      );
    }

    const unitPrice = plate.price as number;
    const total = round2(unitPrice * quantity);
    const code = type === "purchase" ? pickupCode() : null;

    tx.update(plateRef, { reserved: plate.reserved + quantity });
    tx.create(orderRef, {
      type,
      status: type === "purchase" ? "reserved" : "confirmed",
      userId: uid,
      userName: profile.name,
      plateId,
      plateTitle: plate.title,
      category: plate.category,
      restaurantId: plate.restaurantId,
      restaurantName: plate.restaurantName,
      restaurantAddress: plate.restaurantAddress,
      quantity,
      unitPrice,
      originalPrice: plate.originalPrice ?? null,
      total,
      pickupCode: code,
      expiresAt: plate.expiresAt,
      payment: { brand: profile.payment.brand, last4: profile.payment.last4 },
      mealsClaimed: 0,
      mealsDelivered: 0,
      createdAt: FieldValue.serverTimestamp(),
      pickedUpAt: null,
      cancelledAt: null,
    });

    if (type === "donation") {
      for (let i = 0; i < quantity; i++) {
        tx.create(db.collection("meals").doc(), {
          donationId: orderRef.id,
          donorId: uid,
          plateId,
          plateTitle: plate.title,
          description: plate.description,
          category: plate.category,
          dietary: plate.dietary ?? [],
          restaurantId: plate.restaurantId,
          restaurantName: plate.restaurantName,
          restaurantAddress: plate.restaurantAddress,
          value: unitPrice,
          expiresAt: plate.expiresAt,
          status: "available",
          claimedBy: null,
          claimedByName: null,
          claimedAt: null,
          pickupCode: null,
          pickedUpAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    bumpStats(tx, {
      mealsRescued: quantity,
      ...(type === "donation" ? { mealsDonated: quantity } : {}),
    });

    return { orderId: orderRef.id, pickupCode: code, total };
  });

  logger.info("order placed", { uid, type, plateId, quantity, orderId: result.orderId });
  return result;
});

/** Customers can cancel a reservation until its pickup window closes. */
export const cancelOrder = onCall(async (req) => {
  const { uid } = await requireUser(req, ["customer"]);
  const orderRef = db.doc(`orders/${requireString(req.data?.orderId, "orderId")}`);

  await db.runTransaction(async (tx) => {
    const order = (await tx.get(orderRef)).data();
    if (!order || order.userId !== uid) throw new HttpsError("not-found", "Order not found.");
    if (order.status !== "reserved") {
      throw new HttpsError("failed-precondition", "Only active reservations can be cancelled.");
    }
    if ((order.expiresAt as Timestamp).toMillis() <= Date.now()) {
      throw new HttpsError("failed-precondition", "The pickup window has already closed.");
    }

    const plateRef = db.doc(`plates/${order.plateId}`);
    const plate = (await tx.get(plateRef)).data();

    tx.update(orderRef, { status: "cancelled", cancelledAt: FieldValue.serverTimestamp() });
    if (plate) tx.update(plateRef, { reserved: Math.max(0, plate.reserved - order.quantity) });
    bumpStats(tx, { mealsRescued: -order.quantity });
  });

  return { ok: true };
});

// ---------- community meals ----------

/** Community members claim donated meals, up to MAX_ACTIVE_CLAIMS at a time. */
export const claimMeal = onCall(async (req) => {
  const { uid, profile } = await requireUser(req, ["needy"]);
  const mealRef = db.doc(`meals/${requireString(req.data?.mealId, "mealId")}`);

  return db.runTransaction(async (tx) => {
    const active = await tx.get(
      db.collection("meals").where("claimedBy", "==", uid).where("status", "==", "claimed"),
    );
    if (active.size >= MAX_ACTIVE_CLAIMS) {
      throw new HttpsError(
        "resource-exhausted",
        `You can hold up to ${MAX_ACTIVE_CLAIMS} meals at a time. Pick one up or release it to claim another.`,
      );
    }

    const meal = (await tx.get(mealRef)).data();
    if (!meal || meal.status !== "available") {
      throw new HttpsError("failed-precondition", "Someone just claimed this meal. Try another one.");
    }
    if ((meal.expiresAt as Timestamp).toMillis() <= Date.now()) {
      throw new HttpsError("failed-precondition", "This meal's pickup window has closed.");
    }

    const code = pickupCode();
    tx.update(mealRef, {
      status: "claimed",
      claimedBy: uid,
      claimedByName: profile.name,
      claimedAt: FieldValue.serverTimestamp(),
      pickupCode: code,
    });
    tx.update(db.doc(`orders/${meal.donationId}`), { mealsClaimed: FieldValue.increment(1) });
    return { pickupCode: code };
  });
});

/** Gives a claimed meal back to the pool so someone else can have it. */
export const releaseMeal = onCall(async (req) => {
  const { uid } = await requireUser(req, ["needy"]);
  const mealRef = db.doc(`meals/${requireString(req.data?.mealId, "mealId")}`);

  await db.runTransaction(async (tx) => {
    const meal = (await tx.get(mealRef)).data();
    if (!meal || meal.claimedBy !== uid || meal.status !== "claimed") {
      throw new HttpsError("failed-precondition", "This meal isn't currently claimed by you.");
    }
    tx.update(mealRef, {
      status: "available",
      claimedBy: null,
      claimedByName: null,
      claimedAt: null,
      pickupCode: null,
    });
    tx.update(db.doc(`orders/${meal.donationId}`), { mealsClaimed: FieldValue.increment(-1) });
  });

  return { ok: true };
});

// ---------- pickup verification ----------

/**
 * Restaurants verify the 6-character code shown on the customer's or
 * community member's screen. The code is the proof of pickup.
 */
export const confirmPickup = onCall(async (req) => {
  const { uid } = await requireUser(req, ["restaurant"]);
  const code = requireString(req.data?.code, "code", 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) throw new HttpsError("invalid-argument", "Pickup codes are 6 characters.");

  return db.runTransaction(async (tx) => {
    const [orders, meals] = await Promise.all([
      tx.get(
        db.collection("orders")
          .where("restaurantId", "==", uid)
          .where("pickupCode", "==", code)
          .where("status", "==", "reserved")
          .limit(2),
      ),
      tx.get(
        db.collection("meals")
          .where("restaurantId", "==", uid)
          .where("pickupCode", "==", code)
          .where("status", "==", "claimed")
          .limit(2),
      ),
    ]);

    const matches = [...orders.docs, ...meals.docs];
    if (matches.length === 0) {
      throw new HttpsError("not-found", "No open pickup matches that code.");
    }
    if (matches.length > 1) {
      throw new HttpsError("failed-precondition", "That code matches more than one pickup — contact support.");
    }

    const doc = matches[0];
    const data = doc.data();
    tx.update(doc.ref, { status: "picked_up", pickedUpAt: FieldValue.serverTimestamp() });

    if (orders.size === 1) {
      return {
        kind: "purchase" as const,
        title: data.plateTitle,
        quantity: data.quantity,
        name: data.userName,
      };
    }

    tx.update(db.doc(`orders/${data.donationId}`) as DocumentReference, {
      mealsDelivered: FieldValue.increment(1),
    });
    bumpStats(tx, { mealsDelivered: 1 });
    return { kind: "meal" as const, title: data.plateTitle, quantity: 1, name: data.claimedByName };
  });
});

// ---------- administration ----------

/** Suspends or reinstates a member. Suspension also disables sign-in and revokes sessions. */
export const setUserStatus = onCall(async (req) => {
  const { uid: adminUid } = await requireUser(req, ["admin"]);
  const targetUid = requireString(req.data?.uid, "uid");
  const status = req.data?.status;
  if (status !== "active" && status !== "suspended") {
    throw new HttpsError("invalid-argument", "Status must be active or suspended.");
  }
  if (targetUid === adminUid) throw new HttpsError("failed-precondition", "You can't change your own status.");

  const ref = db.doc(`users/${targetUid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Member not found.");

  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
  await getAuth().updateUser(targetUid, { disabled: status === "suspended" });
  if (status === "suspended") await getAuth().revokeRefreshTokens(targetUid);

  logger.info("member status changed", { by: adminUid, targetUid, status });
  return { ok: true };
});

// ---------- triggers ----------

export const onProfileCreated = onDocumentCreated("users/{uid}", async (event) => {
  const profile = event.data?.data();
  if (!profile) return;
  await statsRef.set(
    {
      members: FieldValue.increment(1),
      ...(profile.role === "restaurant" ? { restaurants: FieldValue.increment(1) } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await getAuth()
    .updateUser(event.params.uid, { displayName: profile.name })
    .catch((err) => logger.warn("could not sync displayName", err));
});

/**
 * Housekeeping: closes out anything whose pickup window has passed.
 * Unclaimed/uncollected meals and no-show reservations become "expired".
 */
export const expireStale = onSchedule({ schedule: "every 30 minutes", timeZone: "America/New_York" }, async () => {
  const now = Timestamp.now();
  const graceCutoff = Timestamp.fromMillis(Date.now() - PICKUP_GRACE_MS);

  const jobs: Array<{ collection: string; status: string; before: Timestamp }> = [
    { collection: "meals", status: "available", before: now },
    { collection: "meals", status: "claimed", before: graceCutoff },
    { collection: "orders", status: "reserved", before: graceCutoff },
  ];

  for (const job of jobs) {
    let expired = 0;
    for (;;) {
      const snap = await db
        .collection(job.collection)
        .where("status", "==", job.status)
        .where("expiresAt", "<=", job.before)
        .limit(400)
        .get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.update(d.ref, { status: "expired", expiredAt: now }));
      await batch.commit();
      expired += snap.size;
      if (snap.size < 400) break;
    }
    if (expired) logger.info("expired stale records", { ...job, before: job.before.toDate(), expired });
  }
});
