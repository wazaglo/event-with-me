import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, UserPlus, QrCode, FileBarChart,
  Settings as SettingsIcon, ShieldCheck, LogOut, ScrollText, Menu, CalendarDays,
} from "lucide-react";
import { Logo, useEventSettings } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { signOut } from "@/lib/auth/cognito-client";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Users;
  roles?: ("Admin" | "RegistrationOfficer" | "CheckinOfficer")[];
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/participants", label: "Participants", icon: Users },
  { to: "/walk-in", label: "Walk-in", icon: UserPlus, roles: ["Admin", "RegistrationOfficer"] },
  { to: "/check-in", label: "Check-in", icon: QrCode },
  { to: "/events", label: "Events", icon: CalendarDays, roles: ["Admin"] },
  { to: "/reports", label: "Reports", icon: FileBarChart, roles: ["Admin"] },
  { to: "/staff", label: "Staff", icon: ShieldCheck, roles: ["Admin"] },
  { to: "/audit", label: "Audit log", icon: ScrollText, roles: ["Admin"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["Admin"] },
];

export function AppShell() {
  const staff = useCurrentStaff();
  const { data: settings } = useEventSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(
    () => NAV.filter((n) => !n.roles || n.roles.some((r) => staff.groups.includes(r))),
    [staff.groups],
  );

  const handleSignOut = () => {
    signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };

  const roleLabel = staff.isAdmin
    ? "Administrator"
    : staff.isRegOfficer
      ? "Registration Officer"
      : staff.isCheckinOfficer
        ? "Check-in Officer"
        : "Staff";

  const Nav = (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((n) => {
        const active = location.pathname === n.to || location.pathname.startsWith(n.to + "/");
        const Icon = n.icon;
        return (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const SidebarBody = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <Logo className="h-10 w-10 rounded-full bg-white/90 p-0.5" />
        <div className="leading-tight min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-primary">Event Console</div>
          <div className="truncate text-sm font-semibold">{settings?.name ?? "Summit Console"}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{Nav}</div>
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 rounded-lg bg-sidebar-accent/60 px-3 py-2 text-xs">
          <div className="truncate font-semibold text-sidebar-foreground">{staff.displayName}</div>
          <div className="text-sidebar-foreground/70">{roleLabel}</div>
        </div>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0">{SidebarBody}</aside>
        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  {SidebarBody}
                </SheetContent>
              </Sheet>
              <div className="hidden md:block">
                <div className="text-xs text-muted-foreground">
                  {settings?.date
                    ? new Date(settings.date).toLocaleDateString(undefined, {
                        weekday: "long", year: "numeric", month: "long", day: "numeric",
                      })
                    : "Live console"}
                </div>
              </div>
            </div>
            <div className="text-xs font-medium text-muted-foreground hidden sm:block">
              {settings?.venue ? `📍 ${settings.venue}` : ""}
            </div>
          </header>
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="p-4 md:p-8"
          >
            <Outlet />
          </motion.main>
        </div>
      </div>
    </div>
  );
}
