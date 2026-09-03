import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/auth/cognito-client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: "/auth" });
    return { session };
  },
  component: AppShell,
});
