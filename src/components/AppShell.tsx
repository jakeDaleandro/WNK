import {
  BarChart3,
  ClipboardCheck,
  FileText,
  HandHeart,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShoppingBasket,
  Soup,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProfile, useAuth } from "@/auth/AuthProvider";
import { roles } from "@/lib/meta";
import type { Role } from "@/lib/types";
import { Avatar, cn, IconButton, Logo, Spinner } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const nav: Record<Role, NavItem[]> = {
  customer: [
    { to: "/app/marketplace", label: "Marketplace", icon: ShoppingBasket },
    { to: "/app/orders", label: "My orders", icon: Receipt },
  ],
  donor: [
    { to: "/app/marketplace", label: "Donate meals", icon: HandHeart },
    { to: "/app/donations", label: "My impact", icon: BarChart3 },
  ],
  restaurant: [
    { to: "/app/restaurant", label: "Listings", icon: LayoutDashboard, end: true },
    { to: "/app/restaurant/pickups", label: "Pickups", icon: ClipboardCheck },
  ],
  needy: [{ to: "/app/meals", label: "Free meals", icon: Soup }],
  admin: [
    { to: "/app/admin", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/app/admin/members", label: "Members", icon: Users },
    { to: "/app/admin/reports", label: "Reports", icon: FileText },
  ],
};

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              isActive ? "bg-white/10 text-white" : "text-brand-100/70 hover:bg-white/5 hover:text-white",
            )
          }
        >
          <Icon className="size-[18px]" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const profile = useProfile();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-8">
        <Logo light />
      </div>
      <div className="flex-1 space-y-8 overflow-y-auto px-3">
        <NavList items={nav[profile.role]} onNavigate={onNavigate} />
      </div>
      <div className="space-y-1 border-t border-white/10 p-3">
        <NavLink
          to="/app/account"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              isActive ? "bg-white/10 text-white" : "text-brand-100/70 hover:bg-white/5 hover:text-white",
            )
          }
        >
          <Settings className="size-[18px]" />
          Account
        </NavLink>
        <div className="flex items-center gap-3 rounded-xl px-3 py-3">
          <Avatar name={profile.name} className="bg-brand-700 text-brand-50" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{profile.name}</p>
            <p className="truncate text-xs text-brand-200/70">{roles[profile.role].label}</p>
          </div>
          <IconButton
            icon={LogOut}
            label="Sign out"
            className="text-brand-200/70 hover:bg-white/10 hover:text-white"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-brand-950 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200/70 bg-canvas/85 px-4 backdrop-blur lg:hidden">
        <Logo />
        <IconButton icon={Menu} label="Open menu" onClick={() => setOpen(true)} />
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-stone-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-in bg-brand-950 shadow-2xl">
            <IconButton
              icon={X}
              label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute top-5 right-3 text-brand-100 hover:bg-white/10 hover:text-white"
            />
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <Spinner />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
