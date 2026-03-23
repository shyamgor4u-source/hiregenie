import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, Briefcase, FileText } from "lucide-react";

export default function AdminDashboard() {
  const { authFetch } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/admin/stats");
      return res.json();
    },
  });

  const statCards = [
    { title: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { title: "Companies", value: stats?.totalCompanies ?? 0, icon: Building2, color: "text-chart-2", bg: "bg-accent/10" },
    { title: "Jobs", value: stats?.totalJobs ?? 0, icon: Briefcase, color: "text-chart-3", bg: "bg-green-500/10" },
    { title: "Applications", value: stats?.totalApplications ?? 0, icon: FileText, color: "text-chart-4", bg: "bg-yellow-500/10" },
  ];

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Platform overview</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.title} className="border-card-border">
              <CardContent className="p-5">
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                        {card.title}
                      </p>
                      <p className="text-2xl font-bold font-display" data-testid={`stat-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        {card.value}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppSidebar>
  );
}
