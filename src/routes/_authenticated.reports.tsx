import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, FileType2 } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import { registrationsApi, type ApiRegistration } from "@/lib/api-client";
import { useEvents } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSession } from "@/lib/auth/cognito-client";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Summit Console" }] }),
  ssr: false,
  beforeLoad: async () => {
    const session = await getSession();
    const groups = session?.groups ?? [];
    if (!groups.includes("Admin")) throw redirect({ to: "/dashboard" });
  },
  component: ReportsPage,
});

type ReportKind = "attendance" | "registration" | "walk_in";

function ReportsPage() {
  const { data: events = [] } = useEvents();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [kind, setKind] = useState<ReportKind>("attendance");

  const activeEventId = selectedEventId || events[0]?.eventId || "";

  const query = useQuery({
    queryKey: ["report-all", activeEventId],
    enabled: !!activeEventId,
    queryFn: () => registrationsApi.list(activeEventId),
  });

  const allRows = query.data ?? [];

  const counts = {
    attendance: allRows.filter((r) => r.checkedInAt).length,
    registration: allRows.length,
    walk_in: allRows.filter((r) => r.registrationType === "walk_in").length,
  };

  const rows =
    kind === "attendance" ? allRows.filter((r) => r.checkedInAt)
    : kind === "walk_in"  ? allRows.filter((r) => r.registrationType === "walk_in")
    : allRows;

  const columns = [
    { key: "registrationNumber", label: "Reg No." },
    { key: "fullName", label: "Full name" },
    { key: "organisation", label: "Organisation" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "position", label: "Position" },
    { key: "registrationType", label: "Type" },
    { key: "checkedInAt", label: "Checked in" },
    { key: "createdAt", label: "Registered" },
  ] as const;

  const pretty = (r: ApiRegistration) => ({
    registrationNumber: r.registrationNumber,
    fullName: r.fullName,
    organisation: r.organisation,
    email: r.email,
    phone: r.phone ?? "",
    position: r.position ?? "",
    registrationType: r.registrationType === "walk_in" ? "Walk-in" : "Online",
    checkedInAt: r.checkedInAt ? new Date(r.checkedInAt).toLocaleString() : "",
    createdAt: new Date(r.createdAt).toLocaleString(),
  });

  const exportCSV = () => {
    const csv = Papa.unparse(rows.map(pretty));
    download(new Blob([csv], { type: "text/csv" }), `${kind}-report.csv`);
  };
  const exportXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map(pretty));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${kind}-report.xlsx`);
  };
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${labelFor(kind)} · Event Report`, 14, 15);
    autoTable(doc, {
      startY: 22,
      head: [columns.map((c) => c.label)],
      body: rows.map((r) => columns.map((c) => (pretty(r) as Record<string, string>)[c.key] ?? "")),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 101, 91] },
    });
    doc.save(`${kind}-report.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Reports</div>
        <h1 className="mt-1 text-3xl font-bold">Export event data</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {events.length > 0 && (
          <Select value={activeEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select event" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.eventId} value={e.eventId}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(["attendance", "registration", "walk_in"] as ReportKind[]).map((k) => (
          <Button key={k} variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}
            className={kind === k ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}>
            {labelFor(k)}
            {!query.isLoading && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                kind === k ? "bg-white/20" : "bg-muted text-muted-foreground"
              }`}>{counts[k]}</span>
            )}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={exportCSV} variant="outline" disabled={rows.length === 0}><FileText className="mr-2 h-4 w-4" /> Export CSV</Button>
        <Button onClick={exportXLSX} variant="outline" disabled={rows.length === 0}><Download className="mr-2 h-4 w-4" /> Export Excel</Button>
        <Button onClick={exportPDF} variant="outline" disabled={rows.length === 0}><FileType2 className="mr-2 h-4 w-4" /> Export PDF</Button>
        <div className="ml-auto text-sm text-muted-foreground self-center">
          {query.isLoading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>{columns.map((c) => <th key={c.key} className="px-4 py-3 font-semibold">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={columns.length} className="p-3"><Skeleton className="h-6 w-full" /></td></tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="p-10 text-center text-muted-foreground">No data.</td></tr>
              ) : (
                rows.slice(0, 200).map((r) => {
                  const p = pretty(r);
                  return (
                    <tr key={r.registrationId} className="border-b border-border last:border-0">
                      {columns.map((c) => <td key={c.key} className="px-4 py-2">{(p as Record<string, string>)[c.key]}</td>)}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function labelFor(k: ReportKind) {
  return k === "attendance" ? "Attendance" : k === "walk_in" ? "Walk-ins" : "Registrations";
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
