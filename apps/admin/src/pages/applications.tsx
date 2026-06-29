import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/layout/status-badge";

interface Application {
  id: string;
  status: string;
  appliedAt: string;
  job: { id: string; title: string } | null;
  worker: { id: string; firstName: string; lastName: string; email: string } | null;
}

const columns: ColumnDef<Application, unknown>[] = [
  {
    id: "worker",
    header: "Applicant",
    cell: ({ row }) =>
      row.original.worker ? (
        <div>
          <div className="font-medium">
            {row.original.worker.firstName} {row.original.worker.lastName}
          </div>
          <div className="text-xs text-gray-500">{row.original.worker.email}</div>
        </div>
      ) : (
        "—"
      ),
  },
  { id: "job", header: "Job", cell: ({ row }) => row.original.job?.title ?? "—" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  {
    accessorKey: "appliedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Applied" />,
    cell: ({ row }) => fmtDate(row.original.appliedAt),
  },
];

const STATUSES = ["applied", "reviewed", "shortlisted", "hired", "rejected"].map((s) => ({
  label: s,
  value: s,
}));

export default function ApplicationsPage() {
  return (
    <ListPage<Application>
      title="Applications"
      description="Quick Apply submissions across all jobs."
      queryKey="admin-applications"
      endpoint="/admin/applications?limit=100"
      columns={columns}
      searchPlaceholder="Search…"
      facetedFilters={[{ columnId: "status", title: "Status", options: STATUSES }]}
    />
  );
}
