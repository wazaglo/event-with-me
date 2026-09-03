import logoUrl from "@/assets/logo.png";
import { useQuery } from "@tanstack/react-query";
import { eventsApi, type ApiEvent } from "@/lib/api-client";

// Returns the first *open* event as the active event for public-facing pages.
// Falls back to events[0] if none are open (e.g. between events).
export function useEventSettings() {
  return useQuery({
    queryKey: ["event-settings"],
    queryFn: async () => {
      const events = await eventsApi.list();
      return events.find((e) => e.registrationOpen) ?? events[0] ?? null;
    },
    staleTime: 60_000,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => eventsApi.list(),
    staleTime: 30_000,
  });
}

export function Logo({ className, alt = "Event" }: { className?: string; alt?: string }) {
  const { data } = useEventSettings();
  const src = data?.logoUrl || logoUrl;
  return <img src={src} alt={alt} className={className} />;
}

export { logoUrl };
export type { ApiEvent };
