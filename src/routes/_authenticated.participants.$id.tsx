import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { registrationsApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  organisation: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
});

export const Route = createFileRoute("/_authenticated/participants/$id")({
  head: () => ({ meta: [{ title: "Participant - Summit Console" }] }),
  component: ParticipantDetail,
});

function ParticipantDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Pull from React Query cache populated by participants list
  const cached = useQueryClient()
    .getQueriesData<
      {
        registrationId: string;
        fullName: string;
        organisation: string;
        email: string;
        phone: string | null;
        position: string | null;
        checkedInAt: string | null;
        registrationNumber: string;
      }[]
    >({ queryKey: ["participants"] })
    .flatMap(([, data]) => data ?? [])
    .find((r) => r && r.registrationId === id);

  const q = useQuery({
    queryKey: ["participant", id],
    queryFn: () => registrationsApi.getById(id),
    enabled: !cached,
    retry: 1,
  });

  const participant = cached ?? q.data;

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", organisation: "", email: "", phone: "", position: "" },
  });

  useEffect(() => {
    if (participant) {
      form.reset({
        fullName: participant.fullName,
        organisation: participant.organisation,
        email: participant.email,
        phone: participant.phone ?? "",
        position: participant.position ?? "",
      });
    }
  }, [participant, form]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    if (!form.formState.isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty]);

  const onSubmit = async (v: z.infer<typeof schema>) => {
    try {
      await registrationsApi.update(id, {
        fullName: v.fullName,
        organisation: v.organisation,
        email: v.email.toLowerCase(),
        phone: v.phone || null,
        position: v.position || null,
      });
      toast.success("Participant updated");
      qc.invalidateQueries({ queryKey: ["participants"] });
      qc.invalidateQueries({ queryKey: ["participant", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const checkIn = async () => {
    try {
      await registrationsApi.checkIn(id);
      toast.success("Checked in");
      qc.invalidateQueries({ queryKey: ["participants"] });
      qc.invalidateQueries({ queryKey: ["participant", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check-in failed");
    }
  };

  if (!cached && q.isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="max-w-xl">
        <p className="text-muted-foreground">
          Participant not found. Go back and open from the participants list.
        </p>
        <Button
          onClick={() => navigate({ to: "/participants" })}
          variant="outline"
          className="mt-4"
        >
          Back to participants
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        to="/participants"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to participants
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {participant.registrationNumber}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{participant.fullName}</h1>
            <div className="text-sm text-muted-foreground">{participant.organisation}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {participant.checkedInAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Checked in
              </span>
            ) : (
              <Button
                onClick={checkIn}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Check in
              </Button>
            )}
            <Link to="/badge/$id" params={{ id }}>
              <Button variant="outline">
                <Printer className="mr-2 h-4 w-4" /> Print badge
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="rounded-2xl border border-border bg-card p-6 shadow-soft"
      >
        <h2 className="text-lg font-semibold">Edit details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-sm">Full name</Label>
            <Input {...form.register("fullName")} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Organisation</Label>
            <Input {...form.register("organisation")} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Email</Label>
            <Input type="email" {...form.register("email")} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Phone</Label>
            <Input {...form.register("phone")} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-sm">Position</Label>
            <Input {...form.register("position")} />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
