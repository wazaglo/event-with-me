import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, Download, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Logo, useEventSettings } from "@/components/logo";
import { useEvents } from "@/components/logo";

export const Route = createFileRoute("/register/success/$reg")({
  head: () => ({
    meta: [{ title: "Registration complete - Summit" }, { name: "robots", content: "noindex" }],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { reg } = Route.useParams();
  const { data } = useEventSettings();
  const { data: events = [] } = useEvents();

  // Find the event this registration belongs to so we can clear the right key
  const openEvents = events.filter((e) => e.registrationOpen);
  const hasOtherOpenEvents = openEvents.length > 1;

  const handleRegisterAnother = () => {
    // Clear all stored registrations so the user can register again
    openEvents.forEach((e) => {
      try {
        localStorage.removeItem(`visitorlog.registration.${e.eventId}`);
      } catch {
        /* ignore */
      }
    });
    window.location.href = "/register";
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant"
        >
          <div className="relative bg-hero-gradient p-10 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-accent/20 p-2">
                <CheckCircle2 className="h-6 w-6 text-accent" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
                Registration complete
              </div>
            </div>
            <h1 className="mt-4 text-3xl font-bold md:text-4xl">You're in - enjoy your stay.</h1>
            <p className="mt-2 max-w-xl text-white/85">
              Keep your registration number handy. Show it at the reception desk to collect your
              badge.
            </p>
          </div>
          <div className="grid gap-6 p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your registration number
              </div>
              <div className="mt-1 text-4xl font-black tracking-tight text-primary md:text-5xl">
                {reg}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {data?.name ?? "Financial Architecture Summit"}
                {data?.venue ? ` · ${data.venue}` : ""}
              </p>
            </div>
            <Logo className="h-24 w-24 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-3 border-t border-border bg-secondary/30 p-6">
            <Link to="/">
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" /> Back to home
              </Button>
            </Link>
            {hasOtherOpenEvents && (
              <Button variant="outline" onClick={handleRegisterAnother}>
                <RefreshCw className="mr-2 h-4 w-4" /> Register for another event
              </Button>
            )}
            <a
              href="https://nbc.edu.gh/wp-content/uploads/2026/07/Financial-Architecture-Summit-2026-Programme.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Download Program <Download className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </motion.div>
      </section>
      <SiteFooter />
    </div>
  );
}
