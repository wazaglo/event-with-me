import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, UserPlus, CalendarDays, Printer } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

import { registrationsApi } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentStaff } from "@/lib/hooks/use-auth";
import { getSession } from "@/lib/auth/cognito-client";

const AUTO_CONTINUE_MS = 5000;

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  organisation: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
});

export const Route = createFileRoute("/_authenticated/walk-in")({
  head: () => ({ meta: [{ title: "Walk-in registration - Summit Console" }] }),
  ssr: false,
  beforeLoad: async () => {
    const session = await getSession();
    const groups = session?.groups ?? [];
    // Matches the nav definition: Admin + RegistrationOfficer + CheckinOfficer
    const allowed = ["Admin", "RegistrationOfficer", "CheckinOfficer"];
    if (!groups.some((g) => allowed.includes(g))) throw redirect({ to: "/dashboard" });
  },
  component: WalkInPage,
});

type SuccessInfo = { reg: string; name: string; id: string };

function WalkInPage() {
  const navigate = useNavigate();
  const staff = useCurrentStaff();
  const { data: events = [] } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

  const activeEventId = selectedEventId || events[0]?.eventId || "";

  // Auto-clear success screen after timeout
  useEffect(() => {
    if (!successInfo) return;
    const timer = setTimeout(() => setSuccessInfo(null), AUTO_CONTINUE_MS);
    return () => clearTimeout(timer);
  }, [successInfo]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", organisation: "", email: "", phone: "", position: "" },
  });

  const onSubmit = async (v: z.infer<typeof schema>) => {
    if (!activeEventId) {
      toast.error("Please select an event first");
      return;
    }
    try {
      const data = await registrationsApi.walkIn(activeEventId, {
        fullName: v.fullName,
        organisation: v.organisation,
        email: v.email.toLowerCase(),
        phone: v.phone || undefined,
        position: v.position || undefined,
      });

      form.reset();
      setSuccessInfo({ reg: data.registrationNumber, name: v.fullName, id: data.registrationId });

      // Admins and Registration Officers go straight to badge print
      if (staff.isAdmin || staff.isRegOfficer) {
        toast.success(`Registered ${data.registrationNumber} - opening badge…`);
        navigate({ to: "/badge/$id", params: { id: data.registrationId } });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (msg.toLowerCase().includes("email")) {
        form.setError("email", { message: "This email is already registered for this event" });
      }
      toast.error(msg);
    }
  };

  if (successInfo) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
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
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Registration complete</div>
            </div>
            <h1 className="mt-4 text-3xl font-bold md:text-4xl">{successInfo.name} is registered</h1>
          </div>
          <div className="p-10">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registration number</div>
            <div className="mt-1 text-4xl font-black tracking-tight text-primary md:text-5xl">{successInfo.reg}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-secondary/30 p-6">
            <Button
              onClick={() => setSuccessInfo(null)}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Register another
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/badge/$id", params: { id: successInfo.id } })}
            >
              <Printer className="mr-2 h-4 w-4" /> Print badge
            </Button>
            <p className="text-xs text-muted-foreground">Continuing automatically in a few seconds…</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Reception</div>
        <h1 className="mt-1 text-3xl font-bold">Register walk-in</h1>
        <p className="mt-1 text-muted-foreground">Fast entry - press Tab between fields and Enter to submit.</p>
      </div>

      {events.length > 1 && (
        <div className="flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Select value={activeEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select event" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.eventId} value={e.eventId}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={form.handleSubmit(onSubmit)}
        className="rounded-2xl border border-border bg-card p-6 shadow-elegant md:p-8"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-base font-semibold">Full name *</Label>
            <Input autoFocus className="h-12 text-lg" placeholder="e.g. Kwame Boateng" {...form.register("fullName")} />
            {form.formState.errors.fullName && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.fullName.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Organisation *</Label>
            <Input className="h-11" {...form.register("organisation")} />
            {form.formState.errors.organisation && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.organisation.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Email *</Label>
            <Input type="email" className="h-11" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Phone</Label>
            <Input className="h-11" {...form.register("phone")} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Position</Label>
            <Input className="h-11" {...form.register("position")} />
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => form.reset()}>Reset</Button>
          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {form.formState.isSubmitting
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <UserPlus className="mr-2 h-4 w-4" />}
            Register & print badge
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
