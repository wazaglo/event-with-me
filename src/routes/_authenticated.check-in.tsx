import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  CheckCircle2,
  Clock,
  Printer,
  ArrowRight,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { registrationsApi } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/check-in")({
  head: () => ({ meta: [{ title: "Check-in - Summit Console" }] }),
  component: CheckInPage,
});

function CheckInPage() {
  const [query, setQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const qc = useQueryClient();
  const { data: events = [] } = useEvents();
  const activeEventId = selectedEventId || events[0]?.eventId || "";

  const debounced = useDebounced(query, 300);

  const results = useQuery({
    queryKey: ["checkin-search", activeEventId, debounced],
    enabled: debounced.trim().length > 0 && !!activeEventId,
    queryFn: () => registrationsApi.list(activeEventId, { search: debounced }),
  });

  const checkInAndPrint = async (
    id: string,
    fullName: string,
    checkedInAt: string | null,
    printAfter: boolean,
  ) => {
    if (checkedInAt) {
      if (printAfter) window.open(`/badge/${id}?auto=1`, "_blank");
      return;
    }
    try {
      await registrationsApi.checkIn(id);
      toast.success(`${fullName} checked in`);
      qc.invalidateQueries({ queryKey: ["checkin-search"] });
      qc.invalidateQueries({ queryKey: ["participants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (printAfter) window.open(`/badge/${id}?auto=1`, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check-in failed");
    }
  };

  const rows = useMemo(() => results.data ?? [], [results.data]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          Reception mode
        </div>
        <h1 className="mt-2 text-4xl font-bold">Check in a delegate</h1>
        <p className="mt-1 text-muted-foreground">
          Type any name, organisation, email or registration number.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {events.length > 1 && (
          <Select value={activeEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[200px]">
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
        <div className="relative flex-1 min-w-[280px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-16 rounded-2xl border-2 pl-14 pr-14 text-xl shadow-elegant"
          />
          {results.isFetching && (
            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="space-y-3">
        {query.trim() === "" ? (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Start typing to find a delegate.
          </p>
        ) : results.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No matches found.
          </p>
        ) : (
          rows.map((p, i) => (
            <motion.div
              key={p.registrationId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.15) }}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">{p.fullName}</div>
                  {p.checkedInAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" /> Checked in
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  {p.organisation} · <span className="font-mono">{p.registrationNumber}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/participants/$id" params={{ id: p.registrationId }}>
                  <Button variant="ghost">
                    Open <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                {!p.checkedInAt && (
                  <Button
                    onClick={() =>
                      checkInAndPrint(p.registrationId, p.fullName, p.checkedInAt, false)
                    }
                    className="bg-success text-success-foreground hover:bg-success/90"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Check in
                  </Button>
                )}
                <Button
                  onClick={() => checkInAndPrint(p.registrationId, p.fullName, p.checkedInAt, true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Printer className="mr-2 h-4 w-4" />{" "}
                  {p.checkedInAt ? "Print badge" : "Check in & print"}
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
