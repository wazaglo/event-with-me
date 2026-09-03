import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { auditApi } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/cognito-client";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit log — Summit Console" }] }),
  ssr: false,
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.groups.includes("Admin")) throw redirect({ to: "/dashboard" });
  },
  component: AuditPage,
});

function AuditPage() {

  const q = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => auditApi.list(),
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Audit log</div>
        <h1 className="mt-1 text-3xl font-bold">System activity</h1>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Entity</th>
                <th className="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr><td colSpan={7} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>
              ) : (q.data ?? []).length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No entries yet.</td></tr>
              ) : (
                (q.data ?? []).map((a) => (
                  <tr key={a.auditId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                        {a.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{a.actorLabel ?? <span className="text-muted-foreground">system</span>}</td>
                    <td className="px-4 py-3">{a.meta?.name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">{a.meta?.email ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">{a.meta?.phone ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.entity ?? "—"}{a.entityId ? ` · ${a.entityId.slice(0, 8)}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
