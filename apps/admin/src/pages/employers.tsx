import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/layout/status-badge";

interface Employer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
  companies: { id: string; name: string }[];
  subscription: { plan: string; status: string } | null;
  _count: { jobsPosted: number };
}

const columns: ColumnDef<Employer, unknown>[] = [
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
    id: "company",
    header: "Company",
    cell: ({ row }) => row.original.companies[0]?.name ?? "—",
  },
  {
    id: "plan",
    header: "Subscription",
    cell: ({ row }) =>
      row.original.subscription ? (
        <span className="flex items-center gap-2 capitalize">
          {row.original.subscription.plan}
          <StatusBadge status={row.original.subscription.status} />
        </span>
      ) : (
        "—"
      ),
  },
  { id: "jobs", header: "Jobs posted", accessorFn: (r) => r._count.jobsPosted },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
    cell: ({ row }) => fmtDate(row.original.createdAt),
  },
];

export default function EmployersPage() {
  return (
    <ListPage<Employer>
      title="Employers"
      description="Companies and contractors hiring on BluBranch."
      queryKey="admin-employers"
      endpoint="/admin/employers?limit=100"
      columns={columns}
      searchPlaceholder="Search name or email…"
    />
  );
}
