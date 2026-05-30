import PagePlaceholder from "@/components/layout/page-placeholder";

export default function JobsPage() {
  return (
    <PagePlaceholder
      title="Jobs"
      description="Job listings — review, feature, and moderate postings."
      endpoint="GET /admin/jobs"
    />
  );
}
