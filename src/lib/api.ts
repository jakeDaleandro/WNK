import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

function callable<Req, Res>(name: string) {
  const fn = httpsCallable<Req, Res>(functions, name);
  return async (data: Req) => (await fn(data)).data;
}

export const api = {
  placeOrder: callable<
    { plateId: string; quantity: number; type: "purchase" | "donation" },
    { orderId: string; pickupCode: string | null; total: number }
  >("placeOrder"),
  cancelOrder: callable<{ orderId: string }, { ok: true }>("cancelOrder"),
  claimMeal: callable<{ mealId: string }, { pickupCode: string }>("claimMeal"),
  releaseMeal: callable<{ mealId: string }, { ok: true }>("releaseMeal"),
  confirmPickup: callable<
    { code: string },
    { kind: "purchase" | "meal"; title: string; quantity: number; name: string }
  >("confirmPickup"),
  setUserStatus: callable<{ uid: string; status: "active" | "suspended" }, { ok: true }>("setUserStatus"),
};

const authMessages: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match our records.",
  "auth/user-disabled": "This account has been suspended. Contact support for help.",
  "auth/email-already-in-use": "An account with that email already exists. Try signing in.",
  "auth/weak-password": "Choose a stronger password (at least 8 characters).",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network error — check your connection.",
  "permission-denied": "You don't have permission to do that.",
  unavailable: "We're having trouble reaching the server. Try again shortly.",
};

/** Turns Firebase / callable errors into a sentence suitable for a toast. */
export function errorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    const code = err.code.replace(/^functions\//, "");
    if (err.code.startsWith("functions/") && err.message && code !== "internal") return err.message;
    return authMessages[err.code] ?? authMessages[code] ?? "Something went wrong. Please try again.";
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}
