import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { BoolBadge } from "@/components/layout/status-badge";

interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
  workerProfile: { headline: string | null; city: string | null; state: string | null } | null;
  _count: { applications: number; posts: number };
}

const columns: ColumnDef<Worker, unknown>[] = [
  {
    id: "name",
    accessorFn: (r) => `${r.firstName} ${r.lastName}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <div className="font-medium">
        {row.original.firstName} {row.original.lastName}
      </div>
    ),
  },
  { accessorKey: "email", header: "Email" },
  {
    id: "location",
    header: "Location",
    cell: ({ row }) => {
      const wp = row.original.workerProfile;
      return wp?.city ? `${wp.city}${wp.state ? `, ${wp.state}` : ""}` : "—";
    },
  },
  {
    id: "headline",
    header: "Headline",
    cell: ({ row }) => row.original.workerProfile?.headline ?? "—",
  },
  {
    id: "verified",
    header: "Verified",
    cell: ({ row }) => <BoolBadge value={row.original.isVerified} />,
  },
  {
    id: "applications",
    header: "Applied",
    accessorFn: (r) => r._count.applications,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
    cell: ({ row }) => fmtDate(row.original.createdAt),
  },
];

export default function WorkersPage() {
  return (
    <ListPage<Worker>
      title="Workers"
      description="Tradespeople on BluBranch."
      queryKey="admin-workers"
      endpoint="/admin/workers?limit=100"
      columns={columns}
      searchPlaceholder="Search name or email…"
    />
  );
}
