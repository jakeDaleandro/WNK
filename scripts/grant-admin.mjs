/**
 * Promotes an existing account to administrator. Admin can never be
 * self-assigned through the app, so the first admin is created here.
 *
 *   1. Register normally in the app (any account type except customer/donor is simplest).
 *   2. node scripts/grant-admin.mjs someone@example.com
 *
 * Uses Application Default Credentials for project wnkk-9486c
 * (gcloud auth application-default login, or GOOGLE_APPLICATION_CREDENTIALS).
 * Set FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST to target the emulators.
 */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/grant-admin.mjs <email>");
  process.exit(1);
}

const emulated = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(emulated ? { projectId: "wnkk-9486c" } : { credential: applicationDefault(), projectId: "wnkk-9486c" });

const user = await getAuth().getUserByEmail(email);
const ref = getFirestore().doc(`users/${user.uid}`);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`${email} has no profile yet. Finish registration in the app first.`);
  process.exit(1);
}

// Admin profiles carry no payment or restaurant details (see firestore.rules).
await ref.update({
  role: "admin",
  payment: FieldValue.delete(),
  restaurant: FieldValue.delete(),
  updatedAt: FieldValue.serverTimestamp(),
});
console.log(`${email} (${user.uid}) is now an administrator${emulated ? " [emulator]" : ""}.`);
process.exit(0);
