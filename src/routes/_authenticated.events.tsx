import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { eventsApi, type ApiEvent } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSession } from "@/lib/auth/cognito-client";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({ meta: [{ title: "Events - Summit Console" }] }),
  ssr: false,
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.groups.includes("Admin")) throw redirect({ to: "/dashboard" });
  },
  component: EventsPage,
});

const eventSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  date: z.string().optional(),
  venue: z.string().trim().optional(),
  description: z.string().trim().optional(),
  registrationOpen: z.boolean(),
});

function EventsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ApiEvent | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsApi.list(),
  });

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: { name: "", date: "", venue: "", description: "", registrationOpen: true },
  });

  const openCreate = () => {
    setEditingEvent(null);
    form.reset({ name: "", date: "", venue: "", description: "", registrationOpen: true });
    setOpen(true);
  };

  const openEdit = (e: ApiEvent) => {
    setEditingEvent(e);
    form.reset({
      name: e.name,
      date: e.date ?? "",
      venue: e.venue ?? "",
      description: e.description ?? "",
      registrationOpen: e.registrationOpen,
    });
    setOpen(true);
  };

  const onSubmit = async (v: z.infer<typeof eventSchema>) => {
    try {
      if (editingEvent) {
        await eventsApi.update(editingEvent.eventId, v);
        toast.success("Event updated");
      } else {
        await eventsApi.create(v);
        toast.success("Event created");
      }
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event-settings"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Events
          </div>
          <h1 className="mt-1 text-3xl font-bold">Manage events</h1>
        </div>
        <Button
          onClick={openCreate}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" /> New event
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit event" : "Create event"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm">Event name *</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Date</Label>
              <Input type="date" {...form.register("date")} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Venue</Label>
              <Input {...form.register("venue")} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Description</Label>
              <Input {...form.register("description")} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="text-sm font-medium">Registration open</div>
              <Switch
                checked={form.watch("registrationOpen")}
                onCheckedChange={(v) => form.setValue("registrationOpen", v)}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingEvent ? "Save changes" : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground">
          No events yet. Create your first event to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <div
              key={e.eventId}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-lg">{e.name}</div>
                  {e.date && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(e.date).toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  )}
                  {e.venue && (
                    <div className="text-xs text-muted-foreground mt-0.5">📍 {e.venue}</div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${e.registrationOpen ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                >
                  {e.registrationOpen ? "Open" : "Closed"}
                </span>
              </div>
              {e.description && <p className="text-sm text-muted-foreground">{e.description}</p>}
              <Button variant="outline" size="sm" onClick={() => openEdit(e)}>
                Edit
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
