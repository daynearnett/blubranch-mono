import { Card, CardContent } from "@/components/ui/card";

interface PagePlaceholderProps {
  title: string;
  description: string;
  /** The admin API endpoint this page should eventually call, e.g. GET /admin/workers */
  endpoint?: string;
}

/**
 * Scaffold placeholder. Replace with a real DataTable view wired to the admin API.
 * See packages stub `@/components/data-table/data-table` for the table primitive.
 */
export default function PagePlaceholder({
  title,
  description,
  endpoint,
}: PagePlaceholderProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Card className="mt-6 border-dashed">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            This page is a scaffold. Build the {title.toLowerCase()} view here
            using the shared <code>DataTable</code> component.
          </p>
          {endpoint && (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Suggested endpoint: {endpoint}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
