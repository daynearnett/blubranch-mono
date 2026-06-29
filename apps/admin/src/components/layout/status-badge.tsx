import { Badge } from "@/components/ui/badge";

// Color-maps the various status strings across resources to a consistent look.
const TONE: Record<string, string> = {
  // verification / generic good
  verified: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700",
  open: "bg-emerald-100 text-emerald-700",
  succeeded: "bg-emerald-100 text-emerald-700",
  hired: "bg-emerald-100 text-emerald-700",
  // pending / in-progress
  pending: "bg-amber-100 text-amber-700",
  applied: "bg-amber-100 text-amber-700",
  reviewed: "bg-blue-100 text-blue-700",
  shortlisted: "bg-violet-100 text-violet-700",
  processing: "bg-amber-100 text-amber-700",
  incomplete: "bg-amber-100 text-amber-700",
  past_due: "bg-amber-100 text-amber-700",
  draft: "bg-gray-100 text-gray-600",
  // bad / closed
  rejected: "bg-red-100 text-red-700",
  expired: "bg-red-100 text-red-700",
  closed: "bg-gray-100 text-gray-600",
  canceled: "bg-gray-100 text-gray-600",
};

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const tone = TONE[status] ?? "bg-gray-100 text-gray-600";
  return (
    <Badge variant="outline" className={`border-transparent ${tone}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function BoolBadge({ value, trueLabel = "Yes", falseLabel = "No" }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-transparent ${value ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
    >
      {value ? trueLabel : falseLabel}
    </Badge>
  );
}
