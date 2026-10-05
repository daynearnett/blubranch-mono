import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import api from "@/lib/api";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { BoolBadge } from "@/components/layout/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface TaskRow {
  id: string;
  name: string;
  email: string;
  nudged: boolean;
  actions: number;
  done: boolean;
}

interface DailyTaskResponse {
  date: string;
  task: { key: string; title: string };
  proxy: string | null;
  items: TaskRow[];
  totals: { workers: number; nudged: number; done: number };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const columns: ColumnDef<TaskRow, unknown>[] = [
  {
    id: "name",
    accessorFn: (r) => r.name,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  { accessorKey: "email", header: "Email" },
  {
    id: "nudged",
    accessorFn: (r) => r.nudged,
    header: "Nudged",
    cell: ({ row }) => <BoolBadge value={row.original.nudged} />,
  },
  {
    id: "done",
    accessorFn: (r) => r.done,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Did it" />,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={`border-transparent ${
          row.original.done
            ? "bg-emerald-100 text-emerald-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {row.original.done ? "Done" : "Not yet"}
      </Badge>
    ),
  },
  {
    id: "actions",
    accessorFn: (r) => r.actions,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Actions" />,
    cell: ({ row }) => row.original.actions,
  },
];

export default function DailyTasksPage() {
  const [date, setDate] = useState(todayUtc());

  const { data, isLoading, isError, error } = useQuery<DailyTaskResponse>({
    queryKey: ["admin-daily-task-completion", date],
    queryFn: () =>
      api
        .get(`/admin/daily-task-completion?date=${encodeURIComponent(date)}`)
        .then((r) => r.data),
  });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">
          Daily tasks
          {data ? (
            <span className="ml-2 text-base font-normal text-gray-500">
              {data.task.title}{" "}
              <code className="rounded bg-gray-100 px-1 text-xs">{data.task.key}</code>
            </span>
          ) : null}
        </h1>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
          className="w-auto"
          aria-label="Date"
        />
      </div>
      {data ? (
        <p className="mt-1 text-sm text-gray-500">
          {data.date} — {data.totals.done} of {data.totals.nudged} nudged workers did
          it ({data.totals.workers} worker{data.totals.workers === 1 ? "" : "s"} total).
        </p>
      ) : null}
      {data?.proxy ? (
        <p className="mt-1 text-xs text-amber-600">
          No per-user jobs-board event — "done" means opened the app that day.
        </p>
      ) : null}

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load. {(error as Error)?.message ?? ""}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            searchPlaceholder="Search name or email…"
          />
        )}
      </div>
    </div>
  );
}
