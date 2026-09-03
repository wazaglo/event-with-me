import { Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Ticket, LogIn, LayoutDashboard, ChevronRight } from "lucide-react";
import { Logo, useEventSettings } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { cn } from "@/lib/utils";

function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);
  return scrolled;
}

const NAV_LINKS = [
  { label: "About", href: "/#about" },
  { label: "Register", href: "/register" },
];

export function SiteHeader() {
  const { data } = useEventSettings();
  const { isStaff, loading } = useCurrentStaff();
  const scrolled = useScrolled();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isHome = location.pathname === "/";

  // Close mobile menu on route change
  useEffect(() => setOpen(false), [location.pathname]);

  const eventName = data?.name ?? "Financial Architecture Summit";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          scrolled || !isHome
            ? "border-b border-border/60 bg-background/95 shadow-sm backdrop-blur-md"
            : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">

          {/* Logo + Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Logo className="h-9 w-9 rounded-full ring-2 ring-primary/20 transition group-hover:ring-primary/50" />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
                National Banking College
              </div>
              <div className={cn(
                "text-sm font-semibold transition-colors",
                scrolled || !isHome ? "text-foreground" : "text-foreground",
              )}>
                {eventName}
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground rounded-lg hover:bg-accent/50 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            {!loading && (
              isStaff ? (
                <Link to="/dashboard">
                  <Button size="sm" variant="outline" className="gap-2 font-medium">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button size="sm" variant="ghost" className="gap-2 font-medium text-foreground/70 hover:text-foreground">
                    <LogIn className="h-3.5 w-3.5" />
                    Staff sign in
                  </Button>
                </Link>
              )
            )}
            <Link to="/register">
              <Button size="sm" className="gap-2 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm">
                <Ticket className="h-3.5 w-3.5" />
                Register now
              </Button>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-foreground transition hover:bg-accent"
            aria-label="Toggle menu"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "close" : "open"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-border/60 bg-background/98 backdrop-blur-md md:hidden"
            >
              <div className="mx-auto max-w-6xl space-y-1 px-4 py-4">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground transition-colors"
                  >
                    {link.label}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </a>
                ))}

                <div className="pt-2 border-t border-border/40 space-y-2">
                  {!loading && (
                    isStaff ? (
                      <Link to="/dashboard" onClick={() => setOpen(false)}>
                        <Button variant="outline" className="w-full justify-start gap-2 font-medium">
                          <LayoutDashboard className="h-4 w-4" />
                          Go to Dashboard
                        </Button>
                      </Link>
                    ) : (
                      <Link to="/auth" onClick={() => setOpen(false)}>
                        <Button variant="outline" className="w-full justify-start gap-2 font-medium">
                          <LogIn className="h-4 w-4" />
                          Staff sign in
                        </Button>
                      </Link>
                    )
                  )}
                  <Link to="/register" onClick={() => setOpen(false)}>
                    <Button className="w-full justify-start gap-2 bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
                      <Ticket className="h-4 w-4" />
                      Register now
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

export function SiteFooter() {
  const { data } = useEventSettings();
  const eventName = data?.name ?? "National Banking College Summit";

  return (
    <footer className="border-t border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-10 rounded-full ring-2 ring-primary/20" />
            <div>
              <div className="text-sm font-semibold">{eventName}</div>
              <div className="text-xs text-muted-foreground">Integrity and Excellence</div>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
            <a href="/#about" className="hover:text-foreground transition-colors">About</a>
            <Link to="/register" className="hover:text-foreground transition-colors">Register</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Staff portal</Link>
          </div>
        </div>

        <div className="mt-8 border-t border-border/40 pt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} National Banking College. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">Powered by AWS Serverless</p>
        </div>
      </div>
    </footer>
  );
}
