import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, CheckCircle2, Clock, UserPlus, TrendingUp, CalendarDays } from "lucide-react";
import { registrationsApi, auditApi } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - Summit Console" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: events = [] } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const activeEventId = selectedEventId || events[0]?.eventId || "";

  const stats = useQuery({
    queryKey: ["dashboard-stats", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const all = await registrationsApi.list(activeEventId);
      const checkedIn = all.filter((r) => r.checkedInAt);
      const walkIns = all.filter((r) => r.registrationType === "walk_in");
      const today = all.filter((r) => {
        const d = new Date(r.createdAt);
        const now = new Date();
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      });
      return {
        total: all.length,
        checkedIn: checkedIn.length,
        pending: all.length - checkedIn.length,
        walkIns: walkIns.length,
        today: today.length,
      };
    },
    refetchInterval: 30_000,
  });

  const activity = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => auditApi.list(20),
    refetchInterval: 30_000,
  });

  const cards = [
    {
      label: "Total participants",
      value: stats.data?.total,
      icon: Users,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Checked in",
      value: stats.data?.checkedIn,
      icon: CheckCircle2,
      tone: "bg-success/15 text-success",
    },
    {
      label: "Pending check-in",
      value: stats.data?.pending,
      icon: Clock,
      tone: "bg-accent/25 text-primary",
    },
    {
      label: "Walk-ins",
      value: stats.data?.walkIns,
      icon: UserPlus,
      tone: "bg-secondary text-primary",
    },
    {
      label: "Today",
      value: stats.data?.today,
      icon: TrendingUp,
      tone: "bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Overview
          </div>
          <h1 className="mt-1 text-3xl font-bold">Live event dashboard</h1>
        </div>
        {events.length > 1 && (
          <Select value={activeEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[220px]">
              <CalendarDays className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select event" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.eventId} value={e.eventId}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <div
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </div>
              {stats.isLoading ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <div className="mt-1 text-3xl font-bold tabular-nums">{c.value ?? 0}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Check-in progress bar */}
      {!stats.isLoading && (stats.data?.total ?? 0) > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Check-in progress</span>
            <span className="tabular-nums text-muted-foreground">
              {stats.data!.checkedIn} / {stats.data!.total} (
              {Math.round((stats.data!.checkedIn / stats.data!.total) * 100)}%)
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-success"
              initial={{ width: 0 }}
              animate={{ width: `${(stats.data!.checkedIn / stats.data!.total) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <div className="text-sm font-semibold">Recent activity</div>
          <div className="text-xs text-muted-foreground">Latest actions across all events</div>
        </div>
        <div className="divide-y divide-border">
          {activity.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
            ))
          ) : (activity.data ?? []).length > 0 ? (
            activity.data!.slice(0, 10).map((a) => (
              <div key={a.auditId} className="flex items-start justify-between gap-4 px-6 py-4">
                <div>
                  <div className="text-sm font-medium">{prettyAction(a.action)}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.actorLabel ?? "System"} ·{" "}
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">No activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function prettyAction(action: string) {
  const map: Record<string, string> = {
    "participant.registered": "New online registration",
    "participant.walk_in_registered": "Walk-in registered",
    "participant.edited": "Participant edited",
    "participant.deleted": "Participant deleted",
    "participant.checked_in": "Participant checked in",
    "badge.printed": "Badge printed",
    "user.login": "Coordinator signed in",
    "user.logout": "Coordinator signed out",
    "settings.updated": "Event settings updated",
    "event.created": "New event created",
    "event.updated": "Event updated",
    "staff.created": "Staff member added",
    "staff.role_changed": "Staff role updated",
    "staff.disabled": "Staff account disabled",
    "staff.password_reset": "Password reset sent",
  };
  return map[action] ?? action;
}
