import PagePlaceholder from "@/components/layout/page-placeholder";

export default function PostsPage() {
  return (
    <PagePlaceholder
      title="Posts"
      description="Social feed posts — moderate community content."
      endpoint="GET /admin/posts"
    />
  );
}
