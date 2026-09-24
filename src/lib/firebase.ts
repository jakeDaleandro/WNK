import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// Firebase web config is a public identifier, not a secret — access is enforced
// by Auth, firestore.rules, and the Cloud Functions.
const firebaseConfig = {
  apiKey: "AIzaSyCdXcaQJ3VSHQ2y_jEbprvZcyUcEvzAS14",
  authDomain: "wnkk-9486c.firebaseapp.com",
  projectId: "wnkk-9486c",
  storageBucket: "wnkk-9486c.firebasestorage.app",
  messagingSenderId: "326117768912",
  appId: "1:326117768912:web:a0f4f2a7c3993ee6f9a8d5",
};

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const functions = getFunctions(app, "us-central1");

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8081);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
