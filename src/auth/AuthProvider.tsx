import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  /** True until both the auth state and (if signed in) the profile have loaded. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // uid the current `profile` value was loaded for ("" = signed out). Comparing it
  // with the live user avoids a render where a new user looks loaded but isn't.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
      }),
    [],
  );

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoadedFor("");
      return;
    }
    return onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data({ serverTimestamps: "estimate" }) } as UserProfile) : null);
        setLoadedFor(user.uid);
      },
      () => {
        setProfile(null);
        setLoadedFor(user.uid);
      },
    );
  }, [user]);

  const profileReady = loadedFor === (user?.uid ?? "");

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile: profileReady ? profile : null,
      loading: !authReady || !profileReady,
      signOut: () => fbSignOut(auth),
    }),
    [user, profile, authReady, profileReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For pages rendered behind <RequireAuth>, where a profile is guaranteed. */
export function useProfile(): UserProfile {
  const { profile } = useAuth();
  if (!profile) throw new Error("useProfile used outside an authenticated route");
  return profile;
}
