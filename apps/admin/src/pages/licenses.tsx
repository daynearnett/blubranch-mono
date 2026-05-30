import PagePlaceholder from "@/components/layout/page-placeholder";

export default function LicensesPage() {
  return (
    <PagePlaceholder
      title="Licenses"
      description="License verification queue (state API / manual review)."
      endpoint="GET /admin/licenses"
    />
  );
}
