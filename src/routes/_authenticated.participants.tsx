import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, CheckCircle2, Clock, Printer, Pencil, Trash2, Filter, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { registrationsApi } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCurrentStaff } from "@/lib/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/participants")({
  head: () => ({ meta: [{ title: "Participants — Summit Console" }] }),
  component: ParticipantsPage,
});

function ParticipantsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState("");
  const staff = useCurrentStaff();
  const qc = useQueryClient();
  const { data: events = [] } = useEvents();

  const activeEventId = selectedEventId || events[0]?.eventId || "";

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useQuery({
    queryKey: ["participants", activeEventId, debouncedSearch, type, status],
    enabled: !!activeEventId,
    queryFn: () => registrationsApi.list(activeEventId, { search, type, status }),
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);

  const deleteParticipant = async (id: string, name: string) => {
    try {
      await registrationsApi.delete(id);
      toast.success("Participant deleted");
      qc.invalidateQueries({ queryKey: ["participants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Registration Desk</div>
          <h1 className="mt-1 text-3xl font-bold">All registrations</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {events.length > 1 && (
            <Select value={activeEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-[200px]">
                <CalendarDays className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.eventId} value={e.eventId}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Link to="/walk-in">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">+ Register walk-in</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, organisation, email or reg number…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="walk_in">Walk-in</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="checked">Checked in</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Reg No.</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Organisation</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Check-in</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Registered</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td colSpan={8} className="p-3"><Skeleton className="h-8 w-full" /></td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-16 text-center text-sm text-muted-foreground">
                    {activeEventId ? "No participants match your filters." : "Select an event to view participants."}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <motion.tr
                    key={r.registrationId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.15) }}
                    className="border-b border-border last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.registrationNumber}</td>
                    <td className="px-4 py-3 font-medium">{r.fullName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.organisation}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.registrationType === "walk_in" ? "secondary" : "outline"}>
                        {r.registrationType === "walk_in" ? "Walk-in" : "Online"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.checkedInAt ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3 w-3" /> Checked in
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link to="/badge/$id" params={{ id: r.registrationId }}>
                          <Button variant="ghost" size="icon" title="Print badge"><Printer className="h-4 w-4" /></Button>
                        </Link>
                        <Link to="/participants/$id" params={{ id: r.registrationId }}>
                          <Button variant="ghost" size="icon" title="Edit"><Pencil className="h-4 w-4" /></Button>
                        </Link>
                        {staff.isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Delete" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete participant?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove <span className="font-semibold">{r.fullName}</span> ({r.registrationNumber}).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteParticipant(r.registrationId, r.fullName)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
