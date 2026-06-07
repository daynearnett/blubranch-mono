import PagePlaceholder from "@/components/layout/page-placeholder";

export default function WorkplacesPage() {
  return (
    <PagePlaceholder
      title="Workplaces"
      description="Workplace verification queue (email / manual review)."
      endpoint="GET /admin/work-places"
    />
  );
}
