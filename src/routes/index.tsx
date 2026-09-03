import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarDays, MapPin, Sparkles, ShieldCheck, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, useEventSettings } from "@/components/logo";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { data: settings } = useEventSettings();
  const eventName = settings?.name ?? "Financial Architecture Summit";
  const eventDate = settings?.date
    ? new Date(settings.date).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date to be announced";
  const venue = settings?.venue ?? "Venue to be announced";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-hero-gradient text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-20 md:grid-cols-2 md:px-6 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Official Registration & Check-in
            </div>
            <h1 className="mt-6 text-4xl font-black leading-[1.05] md:text-6xl">
              {eventName}
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/85 md:text-lg">
              A premium gathering of banking, finance and industry leaders. Register in seconds,
              collect your badge at the door, and step into the conversations shaping tomorrow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                  <Ticket className="mr-2 h-4 w-4" /> Register now
                </Button>
              </Link>
              <a href="#about">
                <Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10">
                  Learn more
                </Button>
              </a>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 text-sm md:max-w-md">
              <div className="flex items-center gap-2 text-white/90">
                <CalendarDays className="h-4 w-4 text-accent" /> {eventDate}
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <MapPin className="h-4 w-4 text-accent" /> {venue}
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="relative mx-auto"
          >
            <div className="absolute -inset-8 rounded-full bg-accent/30 blur-3xl" aria-hidden />
            <div className="relative rounded-full bg-white/95 p-4 shadow-elegant">
              <Logo className="h-72 w-72 rounded-full md:h-80 md:w-80" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">About the Summit</div>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">Integrity and Excellence, brought together.</h2>
          <p className="mt-4 text-muted-foreground md:text-lg">
            The Financial Architecture Summit convenes decision-makers, policy leaders and rising
            professionals for a day of keynote addresses, panels and curated networking.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { icon: Users, title: "Industry-defining panels", body: "Focused conversations with senior leaders across banking and finance." },
            { icon: ShieldCheck, title: "Trusted registration", body: "Secure sign-up, unique registration numbers, and professional badges on arrival." },
            { icon: Sparkles, title: "A polished experience", body: "Fast reception check-in, printed badges, and premium hospitality throughout the day." },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* DETAILS */}
      <section className="bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3 md:px-6">
          <DetailBlock label="Date" value={eventDate} icon={CalendarDays} />
          <DetailBlock label="Venue" value={venue} icon={MapPin} />
          <DetailBlock
            label="Registration"
            value={settings?.registrationOpen === false ? "Currently closed" : "Open — register today"}
            icon={Ticket}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center md:px-6">
        <h2 className="text-3xl font-bold md:text-4xl">Ready to reserve your seat?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Complete a short form and receive your unique registration number instantly. Bring it
          with you on the day for a smooth badge collection.
        </p>
        <div className="mt-8">
          <Link to="/register">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
              Begin registration
            </Button>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function DetailBlock({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/25 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
