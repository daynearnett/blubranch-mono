import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { DataTableColumnHeader } from "@/components/data-table/column-header";

interface UsageRow {
  userId: string;
  name: string;
  email: string;
  role: string | null;
  sessions: number;
  totalMs: number;
  avgMs: number;
  last7dMs: number;
  last7dSessions: number;
  lastSeenAt: string | null;
}

// Minutes up to an hour, then h+m. Deliberately coarse: this is a
// participation sanity-check, not a timesheet.
function fmtDuration(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const columns: ColumnDef<UsageRow, unknown>[] = [
  {
    id: "name",
    accessorFn: (r) => r.name,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Person" />,
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  { accessorKey: "email", header: "Email" },
  {
    id: "last7dMs",
    accessorFn: (r) => r.last7dMs,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last 7 days" />,
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{fmtDuration(row.original.last7dMs)}</div>
        <div className="text-xs text-gray-500">
          {row.original.last7dSessions} session{row.original.last7dSessions === 1 ? "" : "s"}
        </div>
      </div>
    ),
  },
  {
    id: "totalMs",
    accessorFn: (r) => r.totalMs,
    header: ({ column }) => <DataTableColumnHeader column={column} title="All time" />,
    cell: ({ row }) => fmtDuration(row.original.totalMs),
  },
  {
    id: "avgMs",
    accessorFn: (r) => r.avgMs,
    header: "Avg session",
    cell: ({ row }) => fmtDuration(row.original.avgMs),
  },
  { accessorKey: "sessions", header: "Sessions" },
  {
    id: "lastSeenAt",
    accessorFn: (r) => r.lastSeenAt ?? "",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last opened" />,
    cell: ({ row }) => (row.original.lastSeenAt ? fmtDate(row.original.lastSeenAt) : "—"),
  },
];

export default function AppUsagePage() {
  return (
    <ListPage<UsageRow>
      title="App usage"
      description="Time spent inside the mobile app, per person. Foreground time only — phone screen time is not readable by an app, so this counts BluBranch and nothing else."
      queryKey="admin-app-usage"
      endpoint="/admin/app-usage?limit=100"
      columns={columns}
      searchPlaceholder="Search name or email…"
    />
  );
}
