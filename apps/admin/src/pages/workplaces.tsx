import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { StatusBadge } from "@/components/layout/status-badge";
import { VerifyActions } from "@/components/layout/row-actions";

interface WorkPlace {
  id: string;
  companyName: string;
  role: string;
  status: string;
  current: boolean;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

const columns: ColumnDef<WorkPlace, unknown>[] = [
  {
    id: "worker",
    header: "Worker",
    cell: ({ row }) =>
      row.original.user ? (
        <div>
          <div className="font-medium">
            {row.original.user.firstName} {row.original.user.lastName}
          </div>
          <div className="text-xs text-gray-500">{row.original.user.email}</div>
        </div>
      ) : (
        "—"
      ),
  },
  { accessorKey: "companyName", header: "Company" },
  { accessorKey: "role", header: "Role" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: "createdAt", header: "Submitted", cell: ({ row }) => fmtDate(row.original.createdAt) },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <VerifyActions
        endpoint="/admin/work-places"
        id={row.original.id}
        status={row.original.status}
        invalidateKey="admin-workplaces"
      />
    ),
  },
];

const STATUSES = ["pending", "verified", "rejected", "expired"].map((s) => ({ label: s, value: s }));

export default function WorkplacesPage() {
  return (
    <ListPage<WorkPlace>
      title="Workplaces"
      description="Workplace verification queue — pending first."
      queryKey="admin-workplaces"
      endpoint="/admin/work-places?limit=100"
      columns={columns}
      searchPlaceholder="Search…"
      facetedFilters={[{ columnId: "status", title: "Status", options: STATUSES }]}
    />
  );
}
