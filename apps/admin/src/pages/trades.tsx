import type { ColumnDef } from "@tanstack/react-table";
import { ListPage } from "@/components/layout/list-page";
import { BoolBadge } from "@/components/layout/status-badge";

interface Trade {
  id: number;
  name: string;
  slug: string;
  isPopular: boolean;
  _count: { jobs: number; userTrades: number; skills: number };
}

const columns: ColumnDef<Trade, unknown>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { accessorKey: "slug", header: "Slug" },
  { id: "popular", header: "Popular", cell: ({ row }) => <BoolBadge value={row.original.isPopular} /> },
  { id: "jobs", header: "Jobs", accessorFn: (r) => r._count.jobs },
  { id: "workers", header: "Workers", accessorFn: (r) => r._count.userTrades },
  { id: "skills", header: "Skills", accessorFn: (r) => r._count.skills },
];

export default function TradesPage() {
  return (
    <ListPage<Trade>
      title="Trades"
      description="Trade taxonomy."
      queryKey="admin-trades"
      endpoint="/admin/trades"
      columns={columns}
      searchPlaceholder="Search trades…"
    />
  );
}
