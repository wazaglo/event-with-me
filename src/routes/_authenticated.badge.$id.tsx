import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { registrationsApi } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ParticipantBadge } from "@/components/participant-badge";
import { Skeleton } from "@/components/ui/skeleton";

const searchSchema = z.object({ auto: z.string().optional() });

export const Route = createFileRoute("/_authenticated/badge/$id")({
  head: () => ({ meta: [{ title: "Print badge - Summit Console" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: BadgePage,
});

function BadgePage() {
  const { id } = Route.useParams();
  const search = useSearch({ from: "/_authenticated/badge/$id" });
  const badgeRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { data: events = [] } = useEvents();

  // Pull participant from cache first, fall back to API fetch
  const cached = useQueryClient()
    .getQueriesData<{ registrationId: string; fullName: string; organisation: string; registrationNumber: string; registrationType: string }[]>({ queryKey: ["participants"] })
    .flatMap(([, data]) => data ?? [])
    .find((r) => r && r.registrationId === id);

  const fetched = useQuery({
    queryKey: ["participant", id],
    queryFn: () => registrationsApi.getById(id),
    enabled: !cached,
    retry: 1,
  });

  const participant = cached ?? fetched.data;
  const isLoading = !cached && fetched.isLoading;

  const activeEvent = events.find((e) => participant && "eventId" in participant && (participant as { eventId?: string }).eventId === e.eventId) ?? events[0];

  const doPrint = useReactToPrint({
    contentRef: badgeRef,
    documentTitle: participant ? `Badge-${participant.registrationNumber}` : "Badge",
    onAfterPrint: async () => {
      try {
        await registrationsApi.printBadge(id);
        qc.invalidateQueries({ queryKey: ["participants"] });
      } catch {
        // non-critical
      }
    },
  });

  const hasTriggeredPrint = useRef(false);

  useEffect(() => {
    if (search.auto === "1" && participant && activeEvent && !hasTriggeredPrint.current) {
      hasTriggeredPrint.current = true;
      const t = setTimeout(() => doPrint(), 300);
      return () => clearTimeout(t);
    }
  }, [search.auto, participant, activeEvent, doPrint]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="mx-auto h-64 w-96 rounded-lg" />
      </div>
    );
  }

  if (!participant || !activeEvent) {
    return (
      <div className="max-w-xl space-y-4">
        <p className="text-muted-foreground">Participant not found. Open from the participants list.</p>
        <Link to="/participants">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to participants</Button>
        </Link>
      </div>
    );
  }

  const badgeSettings = {
    event_name: activeEvent.name,
    logo_url: activeEvent.logoUrl,
    show_qr: activeEvent.showQr,
    show_registration_number: activeEvent.showRegistrationNumber,
    badge_font_size: activeEvent.badgeFontSize,
    primary_color: activeEvent.primaryColor,
    accent_color: activeEvent.accentColor,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to="/participants" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Button onClick={() => doPrint()} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Printer className="mr-2 h-4 w-4" /> Print badge
        </Button>
      </div>

      <div className="no-print rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Badge preview · 100mm × 60mm</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Tip: disable "Headers and footers" and set margins to "None" for a clean edge-to-edge badge.
        </p>
      </div>

      <div className="mx-auto flex justify-center">
        <div ref={badgeRef} className="print-area rounded-lg border border-border bg-white p-4 shadow-elegant">
          <ParticipantBadge
            participant={{
              id: participant.registrationId,
              full_name: participant.fullName,
              organisation: participant.organisation,
              registration_number: participant.registrationNumber,
              registration_type: participant.registrationType as "online" | "walk_in",
            }}
            settings={badgeSettings}
          />
        </div>
      </div>
    </div>
  );
}
