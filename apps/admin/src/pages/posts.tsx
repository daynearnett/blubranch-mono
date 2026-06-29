import type { ColumnDef } from "@tanstack/react-table";
import { ListPage, fmtDate } from "@/components/layout/list-page";
import { StatusBadge } from "@/components/layout/status-badge";
import { ArchiveAction } from "@/components/layout/row-actions";

interface Post {
  id: string;
  content: string;
  archived: boolean;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
  photos: { photoUrl: string }[];
  _count: { likes: number; comments: number };
}

const columns: ColumnDef<Post, unknown>[] = [
  {
    id: "author",
    header: "Author",
    cell: ({ row }) =>
      row.original.user ? (
        <div className="font-medium">
          {row.original.user.firstName} {row.original.user.lastName}
        </div>
      ) : (
        "—"
      ),
  },
  {
    accessorKey: "content",
    header: "Content",
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-md text-sm text-gray-700">{row.original.content}</span>
    ),
  },
  { id: "photos", header: "Photos", accessorFn: (r) => r.photos.length },
  { id: "likes", header: "Likes", accessorFn: (r) => r._count.likes },
  { id: "comments", header: "Comments", accessorFn: (r) => r._count.comments },
  {
    id: "status",
    accessorFn: (r) => (r.archived ? "archived" : "active"),
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.archived ? "closed" : "active"} />,
  },
  { accessorKey: "createdAt", header: "Posted", cell: ({ row }) => fmtDate(row.original.createdAt) },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <ArchiveAction
        id={row.original.id}
        archived={row.original.archived}
        invalidateKey="admin-posts"
      />
    ),
  },
];

const STATUSES = [
  { label: "active", value: "active" },
  { label: "archived", value: "archived" },
];

export default function PostsPage() {
  return (
    <ListPage<Post>
      title="Posts"
      description="Community feed posts — archive to take down."
      queryKey="admin-posts"
      endpoint="/admin/posts?limit=100"
      columns={columns}
      searchPlaceholder="Search content…"
      facetedFilters={[{ columnId: "status", title: "Status", options: STATUSES }]}
    />
  );
}
