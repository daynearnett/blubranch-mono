import PagePlaceholder from "@/components/layout/page-placeholder";

export default function EmployersPage() {
  return (
    <PagePlaceholder
      title="Employers"
      description="Companies and contractors who post jobs."
      endpoint="GET /admin/employers"
    />
  );
}
