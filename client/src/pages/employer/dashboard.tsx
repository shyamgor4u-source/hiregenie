import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Users, Calendar, Award } from "lucide-react";

export default function EmployerDashboard() {
  const { authFetch } = useAuth();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/employer/analytics"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/employer/analytics");
      return res.json();
    },
  });

  const { data: jobs } = useQuery({
    queryKey: ["/api/employer/jobs"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/employer/jobs");
      return res.json();
    },
  });

  const statCards = [
    {
      title: "Active Jobs",
      value: analytics?.activeJobs ?? 0,
      icon: Briefcase,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Total Applicants",
      value: analytics?.totalApplications ?? 0,
      icon: Users,
      color: "text-chart-2",
      bg: "bg-accent/10",
    },
    {
      title: "Interviews",
      value: analytics?.applicationsByStatus?.interview ?? 0,
      icon: Calendar,
      color: "text-chart-3",
      bg: "bg-green-500/10",
    },
    {
      title: "Offers Made",
      value: analytics?.applicationsByStatus?.offer ?? 0,
      icon: Award,
      color: "text-chart-4",
      bg: "bg-yellow-500/10",
    },
  ];

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            Employer Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your hiring activity
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

        {/* Pipeline Summary */}
        <Card className="border-card-border mb-8">
          <CardHeader>
            <CardTitle className="font-display text-base">Pipeline Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: "Applied", value: analytics?.applicationsByStatus?.applied ?? 0, color: "bg-blue-500" },
                  { label: "Shortlisted", value: analytics?.applicationsByStatus?.shortlisted ?? 0, color: "bg-primary" },
                  { label: "Interview", value: analytics?.applicationsByStatus?.interview ?? 0, color: "bg-accent" },
                  { label: "Offer", value: analytics?.applicationsByStatus?.offer ?? 0, color: "bg-green-500" },
                  { label: "Rejected", value: analytics?.applicationsByStatus?.rejected ?? 0, color: "bg-destructive" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className={`h-2 w-full rounded-full ${s.color} mb-2 opacity-70`} />
                    <p className="text-lg font-bold font-display">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle className="font-display text-base">Your Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {!jobs || jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No jobs posted yet</p>
            ) : (
              <div className="space-y-3">
                {jobs.slice(0, 5).map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`job-row-${job.id}`}>
                    <div>
                      <p className="text-sm font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.status} · {job.applicationCount ?? 0} applicants</p>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${job.status === "active" ? "bg-green-500" : "bg-muted-foreground"}`} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppSidebar>
  );
}
