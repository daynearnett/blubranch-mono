import PagePlaceholder from "@/components/layout/page-placeholder";

export default function SkillsPage() {
  return (
    <PagePlaceholder
      title="Skills"
      description="Skill taxonomy — manage the skill catalog."
      endpoint="GET /admin/skills"
    />
  );
}
