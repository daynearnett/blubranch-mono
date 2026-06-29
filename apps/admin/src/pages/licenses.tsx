import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { StatusBadge } from "@/components/layout/status-badge";
import { VerifyActions } from "@/components/layout/row-actions";

interface License {
  id: string;
  type: string;
  number: string;
  issuingState: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

const columns: ColumnDef<License, unknown>[] = [
  {
    id: "holder",
    header: "Holder",
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
  { accessorKey: "type", header: "Type" },
  { accessorKey: "number", header: "Number" },
  { accessorKey: "issuingState", header: "State" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: "expiresAt", header: "Expires", cell: ({ row }) => fmtDate(row.original.expiresAt) },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <VerifyActions
        endpoint="/admin/licenses"
        id={row.original.id}
        status={row.original.status}
        invalidateKey="admin-licenses"
      />
    ),
  },
];

const STATUSES = ["pending", "verified", "rejected", "expired"].map((s) => ({ label: s, value: s }));

export default function LicensesPage() {
  return (
    <ListPage<License>
      title="Licenses"
      description="License verification queue — pending first."
      queryKey="admin-licenses"
      endpoint="/admin/licenses?limit=100"
      columns={columns}
      searchPlaceholder="Search…"
      facetedFilters={[{ columnId: "status", title: "Status", options: STATUSES }]}
    />
  );
}
