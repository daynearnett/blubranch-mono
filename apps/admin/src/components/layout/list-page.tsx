import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import api from "@/lib/api";
import {
  DataTable,
  type FacetedFilterConfig,
} from "@/components/data-table/data-table";

interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

interface ListPageProps<T> {
  title: string;
  description?: string;
  /** React Query cache key. */
  queryKey: string;
  /** API path, e.g. "/admin/workers?limit=100". */
  endpoint: string;
  columns: ColumnDef<T, unknown>[];
  searchPlaceholder?: string;
  facetedFilters?: FacetedFilterConfig[];
  onRowClick?: (row: T) => void;
}

// Shared scaffold for every admin list page: heading + a server-fetched,
// client-paginated DataTable. We fetch a generous page (limit=100) and let the
// table paginate/sort/filter in-memory — fine for beta data volumes.
export function ListPage<T>({
  title,
  description,
  queryKey,
  endpoint,
  columns,
  searchPlaceholder,
  facetedFilters,
  onRowClick,
}: ListPageProps<T>) {
  const { data, isLoading, isError, error } = useQuery<ListResponse<T>>({
    queryKey: [queryKey],
    queryFn: () => api.get(endpoint).then((r) => r.data),
  });

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        {data ? (
          <span className="text-sm text-gray-500">{data.total.toLocaleString()} total</span>
        ) : null}
      </div>
      {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}

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
            searchPlaceholder={searchPlaceholder}
            facetedFilters={facetedFilters}
            onRowClick={onRowClick}
          />
        )}
      </div>
    </div>
  );
}

// Small helpers reused by column defs.
export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
