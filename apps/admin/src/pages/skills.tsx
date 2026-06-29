import type { ColumnDef } from "@tanstack/react-table";
import { ListPage } from "@/components/layout/list-page";

interface Skill {
  id: number;
  name: string;
  trade: { id: number; name: string } | null;
}

const columns: ColumnDef<Skill, unknown>[] = [
  { accessorKey: "name", header: "Skill", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { id: "trade", header: "Trade", cell: ({ row }) => row.original.trade?.name ?? "—" },
];

export default function SkillsPage() {
  return (
    <ListPage<Skill>
      title="Skills"
      description="Skill catalog grouped by trade."
      queryKey="admin-skills"
      endpoint="/admin/skills?limit=100"
      columns={columns}
      searchPlaceholder="Search skills…"
    />
  );
}
