import PagePlaceholder from "@/components/layout/page-placeholder";

export default function TradesPage() {
  return (
    <PagePlaceholder
      title="Trades"
      description="Trade taxonomy — manage trades and popularity flags."
      endpoint="GET /admin/trades"
    />
  );
}
