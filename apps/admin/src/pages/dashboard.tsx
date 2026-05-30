import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardHat, Building2, Briefcase, FileText, BadgeCheck } from "lucide-react";

interface DashboardStats {
  total_workers: number;
  total_employers: number;
  total_jobs: number;
  total_applications: number;
  pending_verifications: number;
}

export default function DashboardPage() {
  // NOTE: wire this to GET /admin/dashboard on the Fastify API.
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/admin/dashboard").then((r) => r.data),
  });

  const cards = [
    {
      title: "Workers",
      value: data?.total_workers ?? 0,
      icon: HardHat,
      color: "bg-orange-100 text-orange-600",
    },
    {
      title: "Employers",
      value: data?.total_employers ?? 0,
      icon: Building2,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Jobs",
      value: data?.total_jobs ?? 0,
      icon: Briefcase,
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      title: "Applications",
      value: data?.total_applications ?? 0,
      icon: FileText,
      color: "bg-violet-100 text-violet-600",
    },
    {
      title: "Pending Verifications",
      value: data?.pending_verifications ?? 0,
      icon: BadgeCheck,
      color: "bg-amber-100 text-amber-600",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {card.title}
              </CardTitle>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}
              >
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
              ) : (
                <div className="text-2xl font-bold tracking-tight">
                  {card.value.toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
