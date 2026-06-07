import PagePlaceholder from "@/components/layout/page-placeholder";

export default function ApplicationsPage() {
  return (
    <PagePlaceholder
      title="Applications"
      description="Quick Apply submissions across all jobs."
      endpoint="GET /admin/applications"
    />
  );
}
