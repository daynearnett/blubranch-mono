import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { StatusBadge } from "@/components/layout/status-badge";
import { IssueStatusActions } from "@/components/layout/row-actions";

interface Issue {
  id: string;
  title: string;
  description: string;
  appVersion: string | null;
  platform: string | null;
  deviceInfo: string | null;
  status: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

const columns: ColumnDef<Issue, unknown>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div className="max-w-md">
        <div className="font-medium">{row.original.title}</div>
        <div className="line-clamp-2 text-sm text-gray-600">{row.original.description}</div>
      </div>
    ),
  },
  {
    id: "reporter",
    header: "Reporter",
    cell: ({ row }) =>
      row.original.user ? (
        <div>
          <div className="text-sm">
            {row.original.user.firstName} {row.original.user.lastName}
          </div>
          <div className="text-xs text-gray-500">{row.original.user.email}</div>
        </div>
      ) : (
        "—"
      ),
  },
  {
    id: "env",
    header: "Env",
    cell: ({ row }) => (
      <span className="text-xs text-gray-500">
        {row.original.platform ?? "—"} {row.original.appVersion ? `· ${row.original.appVersion}` : ""}
      </span>
    ),
  },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  { accessorKey: "createdAt", header: "Submitted", cell: ({ row }) => fmtDate(row.original.createdAt) },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <IssueStatusActions id={row.original.id} status={row.original.status} invalidateKey="admin-issues" />
    ),
  },
];

const STATUSES = ["open", "in_progress", "resolved", "closed"].map((s) => ({ label: s, value: s }));

export default function IssuesPage() {
  return (
    <ListPage<Issue>
      title="Bug reports"
      description="In-app issue reports — open first."
      queryKey="admin-issues"
      endpoint="/admin/issues?limit=100"
      columns={columns}
      searchPlaceholder="Search titles…"
      facetedFilters={[{ columnId: "status", title: "Status", options: STATUSES }]}
    />
  );
}
