import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { StatusBadge } from "@/components/layout/status-badge";
import { ResolveReportActions } from "@/components/layout/row-actions";

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; firstName: string; lastName: string; email: string } | null;
  target: { summary?: string; author?: string; email?: string; archived?: boolean } | null;
}

const columns: ColumnDef<Report, unknown>[] = [
  {
    id: "target",
    header: "Reported content",
    cell: ({ row }) => (
      <div className="max-w-md">
        <span className="text-xs font-semibold uppercase text-gray-400">{row.original.targetType}</span>
        <div className="line-clamp-2 text-sm text-gray-700">{row.original.target?.summary ?? "—"}</div>
        {row.original.target?.author ? (
          <div className="text-xs text-gray-500">by {row.original.target.author}</div>
        ) : null}
      </div>
    ),
  },
  { accessorKey: "reason", header: "Reason", cell: ({ row }) => <span className="capitalize">{row.original.reason}</span> },
  {
    id: "details",
    header: "Details",
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-xs text-sm text-gray-600">{row.original.details ?? "—"}</span>
    ),
  },
  {
    id: "reporter",
    header: "Reported by",
    cell: ({ row }) =>
      row.original.reporter ? (
        <div>
          <div className="text-sm">
            {row.original.reporter.firstName} {row.original.reporter.lastName}
          </div>
          <div className="text-xs text-gray-500">{row.original.reporter.email}</div>
        </div>
      ) : (
        "—"
      ),
  },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: "createdAt", header: "Reported", cell: ({ row }) => fmtDate(row.original.createdAt) },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <ResolveReportActions
        id={row.original.id}
        status={row.original.status}
        targetType={row.original.targetType}
        invalidateKey="admin-reports"
      />
    ),
  },
];

const STATUSES = ["pending", "reviewing", "resolved", "dismissed"].map((s) => ({ label: s, value: s }));

export default function ReportsPage() {
  return (
    <ListPage<Report>
      title="Reports"
      description="User-reported content — pending first. Resolve to remove, or dismiss."
      queryKey="admin-reports"
      endpoint="/admin/reports?limit=100"
      columns={columns}
      searchPlaceholder="Search…"
      facetedFilters={[{ columnId: "status", title: "Status", options: STATUSES }]}
    />
  );
}
