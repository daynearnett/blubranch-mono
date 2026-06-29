import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";

// Verify / reject a pending license or workplace. `endpoint` is the resource
// base (e.g. "/admin/licenses"); we PUT `${endpoint}/${id}` { status }.
export function VerifyActions({
  endpoint,
  id,
  status,
  invalidateKey,
}: {
  endpoint: string;
  id: string;
  status: string;
  invalidateKey: string;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (next: "verified" | "rejected") =>
      api.put(`${endpoint}/${id}`, { status: next }),
    onSuccess: (_res, next) => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(next === "verified" ? "Verified" : "Rejected");
    },
    onError: () => toast.error("Action failed"),
  });

  if (status !== "pending") return <span className="text-sm text-gray-400">—</span>;

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={mut.isPending}
        onClick={(e) => {
          e.stopPropagation();
          mut.mutate("verified");
        }}
      >
        Verify
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-600 hover:text-red-700"
        disabled={mut.isPending}
        onClick={(e) => {
          e.stopPropagation();
          mut.mutate("rejected");
        }}
      >
        Reject
      </Button>
    </div>
  );
}

// Archive / restore a post (admin takedown).
export function ArchiveAction({
  id,
  archived,
  invalidateKey,
}: {
  id: string;
  archived: boolean;
  invalidateKey: string;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (next: boolean) => api.put(`/admin/posts/${id}/archive`, { archived: next }),
    onSuccess: (_res, next) => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      toast.success(next ? "Post archived" : "Post restored");
    },
    onError: () => toast.error("Action failed"),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className={archived ? "" : "text-red-600 hover:text-red-700"}
      disabled={mut.isPending}
      onClick={(e) => {
        e.stopPropagation();
        mut.mutate(!archived);
      }}
    >
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}

// Resolve / dismiss a content report. For post targets, "Resolve & remove" also
// archives the offending post.
export function ResolveReportActions({
  id,
  status,
  targetType,
  invalidateKey,
}: {
  id: string;
  status: string;
  targetType: string;
  invalidateKey: string;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (body: { status: string; archiveTarget?: boolean }) =>
      api.put(`/admin/reports/${id}`, body),
    onSuccess: (_res, body) => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(body.status === "dismissed" ? "Dismissed" : "Resolved");
    },
    onError: () => toast.error("Action failed"),
  });

  if (status === "resolved" || status === "dismissed")
    return <span className="text-sm text-gray-400">—</span>;

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="text-red-600 hover:text-red-700"
        disabled={mut.isPending}
        onClick={(e) => {
          e.stopPropagation();
          mut.mutate({ status: "resolved", archiveTarget: targetType === "post" });
        }}
      >
        {targetType === "post" ? "Resolve & remove" : "Resolve"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={mut.isPending}
        onClick={(e) => {
          e.stopPropagation();
          mut.mutate({ status: "dismissed" });
        }}
      >
        Dismiss
      </Button>
    </div>
  );
}

// Advance an in-app bug report's status.
export function IssueStatusActions({
  id,
  status,
  invalidateKey,
}: {
  id: string;
  status: string;
  invalidateKey: string;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (next: string) => api.put(`/admin/issues/${id}`, { status: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Updated");
    },
    onError: () => toast.error("Action failed"),
  });

  if (status === "resolved" || status === "closed") {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={mut.isPending}
        onClick={(e) => {
          e.stopPropagation();
          mut.mutate("open");
        }}
      >
        Reopen
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      {status === "open" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={mut.isPending}
          onClick={(e) => {
            e.stopPropagation();
            mut.mutate("in_progress");
          }}
        >
          Start
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={mut.isPending}
        onClick={(e) => {
          e.stopPropagation();
          mut.mutate("resolved");
        }}
      >
        Resolve
      </Button>
    </div>
  );
}
