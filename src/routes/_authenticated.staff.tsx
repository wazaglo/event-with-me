import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/cognito-client";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff - Summit Console" }] }),
  ssr: false,
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.groups.includes("Admin")) throw redirect({ to: "/dashboard" });
  },
  component: StaffPage,
});

const groupLabels: Record<string, { label: string; description: string }> = {
  Admin: { label: "Administrator", description: "Full access - events, staff, reports, settings, audit" },
  RegistrationOfficer: { label: "Registration Officer", description: "Walk-in registration and participant management" },
  CheckinOfficer: { label: "Check-in Officer", description: "Check-in and limited walk-in access" },
};

function StaffPage() {

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Staff</div>
        <h1 className="mt-1 text-3xl font-bold">Coordinator management</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div className="text-sm font-semibold">Managing staff via AWS Cognito</div>
        </div>
        <p className="text-sm text-muted-foreground">
          Staff accounts are managed directly in the <strong>AWS Cognito User Pool</strong>.
          A staff management API is on the roadmap - for now use the AWS Console or CLI below.
        </p>
        <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add a staff member</div>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
            <li>AWS Console → <strong>Cognito → User Pools → event-with-me-prod</strong></li>
            <li>Click <strong>Create user</strong> - enter email + temporary password</li>
            <li>Go to <strong>Groups</strong> → add user to the appropriate group below</li>
          </ol>
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Disable or reset a staff member</div>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
            <li>Select the user in Cognito → <strong>Disable user</strong> to revoke access immediately</li>
            <li>Select the user → <strong>Reset password</strong> to send a new temporary password</li>
          </ol>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(groupLabels).map(([key, { label, description }]) => (
          <div key={key} className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-2">
            <Badge variant="outline" className="font-mono text-xs">{key}</Badge>
            <div className="text-sm font-semibold">{label}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
