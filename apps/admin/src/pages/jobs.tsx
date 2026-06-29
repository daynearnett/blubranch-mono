import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { StatusBadge } from "@/components/layout/status-badge";

interface Job {
  id: string;
  title: string;
  status: string;
  planTier: string;
  isFeatured: boolean;
  payMin: number;
  payMax: number;
  createdAt: string;
  company: { id: string; name: string } | null;
  trade: { id: number; name: string } | null;
  applicantCount: number;
}

const columns: ColumnDef<Job, unknown>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    cell: ({ row }) => <div className="font-medium">{row.original.title}</div>,
  },
  { id: "company", header: "Company", cell: ({ row }) => row.original.company?.name ?? "—" },
  { id: "trade", header: "Trade", cell: ({ row }) => row.original.trade?.name ?? "—" },
  {
    id: "pay",
    header: "Pay",
    cell: ({ row }) => `$${row.original.payMin}–$${row.original.payMax}/hr`,
  },
  { accessorKey: "planTier", header: "Plan", cell: ({ row }) => <span className="capitalize">{row.original.planTier}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { id: "applicants", header: "Applicants", accessorFn: (r) => r.applicantCount },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Posted" />,
    cell: ({ row }) => fmtDate(row.original.createdAt),
  },
];

const STATUSES = ["draft", "open", "closed", "expired"].map((s) => ({ label: s, value: s }));

export default function JobsPage() {
  return (
    <ListPage<Job>
      title="Jobs"
      description="Job listings across the platform."
      queryKey="admin-jobs"
      endpoint="/admin/jobs?limit=100"
      columns={columns}
      searchPlaceholder="Search titles…"
      facetedFilters={[{ columnId: "status", title: "Status", options: STATUSES }]}
    />
  );
}
