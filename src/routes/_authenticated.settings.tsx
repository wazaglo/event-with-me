import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { eventsApi } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSession } from "@/lib/auth/cognito-client";

const settingsSchema = z.object({
  name: z.string().trim().min(2, "Event name is required").max(160),
  date: z.string().optional(),
  venue: z.string().trim().max(200).optional(),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || v.startsWith("https://"), { message: "Logo URL must start with https://" }),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex colour"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex colour"),
  registrationOpen: z.boolean(),
  badgeFontSize: z.coerce.number().int().min(12, "Minimum 12").max(28, "Maximum 28"),
  showQr: z.boolean(),
  showRegistrationNumber: z.boolean(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Event settings — Summit Console" }] }),
  ssr: false,
  beforeLoad: async () => {
    const session = await getSession();
    const groups = session?.groups ?? [];
    if (!groups.includes("Admin")) throw redirect({ to: "/dashboard" });
  },
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: events = [] } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState("");

  const activeEventId = selectedEventId || events[0]?.eventId || "";

  const q = useQuery({
    queryKey: ["event-settings-admin", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const all = await eventsApi.list();
      return all.find((e) => e.eventId === activeEventId) ?? null;
    },
  });

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    if (q.data) {
      form.reset({
        name: q.data.name,
        date: q.data.date ?? "",
        venue: q.data.venue ?? "",
        logoUrl: q.data.logoUrl ?? "",
        primaryColor: q.data.primaryColor,
        accentColor: q.data.accentColor,
        registrationOpen: q.data.registrationOpen,
        badgeFontSize: q.data.badgeFontSize,
        showQr: q.data.showQr,
        showRegistrationNumber: q.data.showRegistrationNumber,
      });
    }
  }, [q.data, form]);

  const onSubmit = async (v: SettingsForm) => {
    if (!activeEventId) return;
    try {
      await eventsApi.update(activeEventId, {
        name: v.name,
        date: v.date || null,
        venue: v.venue || null,
        logoUrl: v.logoUrl || null,
        primaryColor: v.primaryColor,
        accentColor: v.accentColor,
        registrationOpen: v.registrationOpen,
        badgeFontSize: Number(v.badgeFontSize),
        showQr: v.showQr,
        showRegistrationNumber: v.showRegistrationNumber,
      });
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-settings"] });
      qc.invalidateQueries({ queryKey: ["event-settings-admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  if (q.isLoading) return <Skeleton className="h-72 w-full max-w-3xl" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Settings</div>
        <h1 className="mt-1 text-3xl font-bold">Event configuration</h1>
      </div>

      {events.length > 1 && (
        <Select value={activeEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select event" /></SelectTrigger>
          <SelectContent>
            {events.map((e) => (
              <SelectItem key={e.eventId} value={e.eventId}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <Section title="Event">
          <Row>
            <Field label="Event name" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label="Event date" error={form.formState.errors.date?.message}>
              <Input type="date" {...form.register("date")} />
            </Field>
          </Row>
          <Row>
            <Field label="Venue" error={form.formState.errors.venue?.message}>
              <Input {...form.register("venue")} />
            </Field>
            <Field label="Logo URL (optional)" error={form.formState.errors.logoUrl?.message}>
              <Input placeholder="https://…" {...form.register("logoUrl")} />
            </Field>
          </Row>
        </Section>

        <Section title="Branding">
          <Row>
            <Field label="Primary colour" error={form.formState.errors.primaryColor?.message}>
              <Input type="color" {...form.register("primaryColor")} />
            </Field>
            <Field label="Accent colour" error={form.formState.errors.accentColor?.message}>
              <Input type="color" {...form.register("accentColor")} />
            </Field>
          </Row>
        </Section>

        <Section title="Registration">
          <Toggle
            label="Registration open"
            description="Turn off to close public registration."
            checked={form.watch("registrationOpen")}
            onCheckedChange={(v) => form.setValue("registrationOpen", v)}
          />
        </Section>

        <Section title="Badge">
          <Row>
            <Field label="Font size (name)" error={form.formState.errors.badgeFontSize?.message}>
              <Input type="number" min={12} max={28} {...form.register("badgeFontSize")} />
            </Field>
          </Row>
          <Toggle label="Show QR code" checked={form.watch("showQr")} onCheckedChange={(v) => form.setValue("showQr", v)} />
          <Toggle label="Show registration number" checked={form.watch("showRegistrationNumber")} onCheckedChange={(v) => form.setValue("showRegistrationNumber", v)} />
        </Section>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-3 text-sm font-semibold">{title}</div><div className="space-y-3">{children}</div></div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
function Toggle({ label, description, checked, onCheckedChange }: { label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
