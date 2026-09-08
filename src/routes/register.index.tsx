import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { registrationsApi } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(120),
  organisation: z.string().trim().min(2, "Please enter your organisation").max(160),
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .max(255)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Enter a valid email address",
    }),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[\d\s+\-()]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
});
type RegisterInput = z.infer<typeof registerSchema>;

const STORED_KEY = (eventId: string) => `visitorlog.registration.${eventId}`;

function getStoredReg(eventId: string): string | null {
  try {
    const raw = localStorage.getItem(STORED_KEY(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { registrationNumber?: string };
    return typeof parsed.registrationNumber === "string" ? parsed.registrationNumber : null;
  } catch {
    return null;
  }
}

function storeReg(eventId: string, registrationNumber: string) {
  try {
    localStorage.setItem(STORED_KEY(eventId), JSON.stringify({ registrationNumber }));
  } catch {
    /* ignore */
  }
}

export function clearStoredReg(eventId: string) {
  try {
    localStorage.removeItem(STORED_KEY(eventId));
  } catch {
    /* ignore */
  }
}

export const Route = createFileRoute("/register/")({
  head: () => ({
    meta: [
      { title: "Register - Summit Registration" },
      { name: "description", content: "Register for the event." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [checkedExisting, setCheckedExisting] = useState(false);

  const activeEvent =
    events.find((e) => e.eventId === selectedEventId) ??
    events.find((e) => e.registrationOpen) ??
    events[0];

  useEffect(() => {
    if (!activeEvent) return;
    const existing = getStoredReg(activeEvent.eventId);
    if (existing) {
      navigate({ to: "/register/success/$reg", params: { reg: existing }, replace: true });
      return;
    }
    setCheckedExisting(true);
  }, [navigate, activeEvent]);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", organisation: "", email: "", phone: "", position: "" },
  });

  const onSubmit = async (values: RegisterInput) => {
    if (!activeEvent) {
      toast.error("No event available for registration");
      return;
    }
    try {
      const data = await registrationsApi.register(activeEvent.eventId, {
        fullName: values.fullName,
        organisation: values.organisation,
        email: values.email.toLowerCase(),
        phone: values.phone || undefined,
        position: values.position || undefined,
      });
      storeReg(activeEvent.eventId, data.registrationNumber);
      navigate({ to: "/register/success/$reg", params: { reg: data.registrationNumber } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (msg.toLowerCase().includes("email")) {
        form.setError("email", { message: "This email is already registered" });
        toast.error("This email is already registered");
        return;
      }
      toast.error(msg);
    }
  };

  if (!checkedExisting || eventsLoading)
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <section className="mx-auto max-w-3xl px-4 py-14 md:px-6">
          <Skeleton className="h-4 w-28" />
          <div className="mt-6 rounded-2xl border border-border bg-card shadow-elegant p-8 md:p-10 space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-80" />
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={i === 4 ? "md:col-span-2" : ""}>
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        </section>
        <SiteFooter />
      </div>
    );

  const closed = !activeEvent || !activeEvent.registrationOpen;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-border bg-card shadow-elegant"
        >
          <div className="p-8 md:p-10">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Registration
            </div>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">Reserve your seat</h1>
            <p className="mt-2 text-muted-foreground">
              Fill in your details below. You'll receive a unique registration number to bring on
              the day.
            </p>

            {activeEvent && (
              <div className="mt-6 rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{activeEvent.name}</p>
                    {activeEvent.date && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(activeEvent.date).toLocaleDateString(undefined, {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    )}
                    {activeEvent.venue && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{activeEvent.venue}</p>
                    )}
                  </div>
                  {events.length > 1 && (
                    <Select
                      value={selectedEventId}
                      onValueChange={(v) => {
                        setSelectedEventId(v);
                        form.reset();
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Switch event" />
                      </SelectTrigger>
                      <SelectContent>
                        {events
                          .filter((e) => e.registrationOpen)
                          .map((e) => (
                            <SelectItem key={e.eventId} value={e.eventId}>
                              {e.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {activeEvent.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{activeEvent.description}</p>
                )}
              </div>
            )}

            {closed ? (
              <div className="mt-8 rounded-lg border border-accent/50 bg-accent/15 p-4 text-sm">
                <p className="font-medium">
                  {activeEvent?.name ?? "This event"} - registration is currently closed.
                </p>
                {activeEvent?.date && (
                  <p className="mt-1 text-muted-foreground">
                    Event date:{" "}
                    {new Date(activeEvent.date).toLocaleDateString(undefined, {
                      dateStyle: "long",
                    })}
                  </p>
                )}
                <p className="mt-1 text-muted-foreground">
                  Please check back later or contact the organisers.
                </p>
              </div>
            ) : (
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2"
              >
                <Field label="Full name" required error={form.formState.errors.fullName?.message}>
                  <Input
                    autoComplete="name"
                    placeholder="e.g. Ama Owusu"
                    {...form.register("fullName")}
                  />
                </Field>
                <Field
                  label="Organisation"
                  required
                  error={form.formState.errors.organisation?.message}
                >
                  <Input
                    autoComplete="organization"
                    placeholder="Company / Institution"
                    {...form.register("organisation")}
                  />
                </Field>
                <Field label="Email address" required error={form.formState.errors.email?.message}>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    {...form.register("email")}
                  />
                </Field>
                <Field label="Phone number" error={form.formState.errors.phone?.message}>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Phone number (optional)"
                    {...form.register("phone")}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field
                    label="Position / Job title"
                    error={form.formState.errors.position?.message}
                  >
                    <Input placeholder="Optional" {...form.register("position")} />
                  </Field>
                </div>
                <div className="md:col-span-2 mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    By registering you agree to receive event-related communications.
                  </p>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={form.formState.isSubmitting}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    {form.formState.isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Complete registration
                  </Button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </section>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
