import PagePlaceholder from "@/components/layout/page-placeholder";

export default function WorkersPage() {
  return (
    <PagePlaceholder
      title="Workers"
      description="Tradespeople on BluBranch — view, search, and verify worker accounts."
      endpoint="GET /admin/workers"
    />
  );
}
