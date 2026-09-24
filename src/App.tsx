import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { GuestOnly, RequireAuth, RequireRole, RoleHome } from "./auth/guards";
import { AppShell } from "./components/AppShell";
import { FullPageLoader } from "./components/ui";
import { Landing } from "./pages/Landing";
import { ForgotPassword, Login } from "./pages/Login";
import { NotFound } from "./pages/NotFound";
import { Register } from "./pages/Register";

const Marketplace = lazy(() => import("./pages/Marketplace"));
const Orders = lazy(() => import("./pages/Orders"));
const Donations = lazy(() => import("./pages/Donations"));
const Meals = lazy(() => import("./pages/Meals"));
const Listings = lazy(() => import("./pages/restaurant/Listings"));
const Pickups = lazy(() => import("./pages/restaurant/Pickups"));
const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const Members = lazy(() => import("./pages/admin/Members"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const Account = lazy(() => import("./pages/Account"));

export function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        <Route path="/app" element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<RoleHome />} />
            <Route element={<RequireRole roles={["customer", "donor"]} />}>
              <Route path="marketplace" element={<Marketplace />} />
            </Route>
            <Route element={<RequireRole roles={["customer"]} />}>
              <Route path="orders" element={<Orders />} />
            </Route>
            <Route element={<RequireRole roles={["donor"]} />}>
              <Route path="donations" element={<Donations />} />
            </Route>
            <Route element={<RequireRole roles={["needy"]} />}>
              <Route path="meals" element={<Meals />} />
            </Route>
            <Route element={<RequireRole roles={["restaurant"]} />}>
              <Route path="restaurant" element={<Listings />} />
              <Route path="restaurant/pickups" element={<Pickups />} />
            </Route>
            <Route element={<RequireRole roles={["admin"]} />}>
              <Route path="admin" element={<AdminOverview />} />
              <Route path="admin/members" element={<Members />} />
              <Route path="admin/reports" element={<Reports />} />
            </Route>
            <Route path="account" element={<Account />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
