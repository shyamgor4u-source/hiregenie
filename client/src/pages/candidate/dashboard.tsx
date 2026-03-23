import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Users, Award, TrendingUp } from "lucide-react";

export default function CandidateDashboard() {
  const { authFetch } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/candidates/stats"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/candidates/stats");
      return res.json();
    },
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/candidates/profile"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/candidates/profile");
      return res.json();
    },
  });

  const statCards = [
    {
      title: "Applications",
      value: stats?.total ?? 0,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Interviews",
      value: stats?.interview ?? 0,
      icon: Users,
      color: "text-chart-2",
      bg: "bg-accent/10",
    },
    {
      title: "Offers",
      value: stats?.offer ?? 0,
      icon: Award,
      color: "text-chart-3",
      bg: "bg-green-500/10",
    },
    {
      title: "Profile Strength",
      value: profileData?.profile?.profileStrength ? `${profileData.profile.profileStrength}%` : "0%",
      icon: TrendingUp,
      color: "text-chart-4",
      bg: "bg-yellow-500/10",
    },
  ];

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            Candidate Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your job search progress
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <Card key={card.title} className="border-card-border">
              <CardContent className="p-5">
                {statsLoading || profileLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                        {card.title}
                      </p>
                      <p className="text-2xl font-bold font-display" data-testid={`stat-${card.title.toLowerCase()}`}>
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

        {/* Status Breakdown */}
        <Card className="border-card-border">
          <CardHeader>
            <CardTitle className="font-display text-base">Application Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: "Applied", value: stats?.applied ?? 0, color: "bg-blue-500" },
                  { label: "Shortlisted", value: stats?.shortlisted ?? 0, color: "bg-primary" },
                  { label: "Interview", value: stats?.interview ?? 0, color: "bg-accent" },
                  { label: "Offer", value: stats?.offer ?? 0, color: "bg-green-500" },
                  { label: "Rejected", value: stats?.rejected ?? 0, color: "bg-destructive" },
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
      </div>
    </AppSidebar>
  );
}
