import { Navigate, Outlet, useLocation } from "react-router-dom";
import { FullPageLoader } from "@/components/ui";
import type { Role } from "@/lib/types";
import { Suspended } from "@/pages/Suspended";
import { useAuth } from "./AuthProvider";

export const homeFor: Record<Role, string> = {
  customer: "/app/marketplace",
  donor: "/app/marketplace",
  restaurant: "/app/restaurant",
  needy: "/app/meals",
  admin: "/app/admin",
};

/** Signed in + profile complete + active. */
export function RequireAuth() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) return <Navigate to="/register" replace />;
  if (profile.status !== "active") return <Suspended />;
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function RoleHome() {
  const { profile } = useAuth();
  return <Navigate to={profile ? homeFor[profile.role] : "/login"} replace />;
}

/** Sends already-signed-in users past the auth screens. */
export function GuestOnly() {
  const { user, profile, loading } = useAuth();
  // Keep the form mounted while a just-created account's profile is loading,
  // so an in-flight sign-up isn't interrupted.
  if (loading && !user) return <FullPageLoader />;
  if (user && profile) return <Navigate to="/app" replace />;
  return <Outlet />;
}
