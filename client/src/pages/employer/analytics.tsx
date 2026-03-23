import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "hsl(25, 95%, 53%)",   // primary orange
  "hsl(262, 83%, 58%)",  // accent purple
  "hsl(173, 58%, 39%)",  // chart-3
  "hsl(43, 74%, 49%)",   // chart-4
  "hsl(0, 84%, 42%)",    // destructive
];

export default function EmployerAnalytics() {
  const { authFetch } = useAuth();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/employer/analytics"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/employer/analytics");
      return res.json();
    },
  });

  const pipelineData = analytics?.applicationsByStatus
    ? [
        { name: "Applied", value: analytics.applicationsByStatus.applied || 0 },
        { name: "Shortlisted", value: analytics.applicationsByStatus.shortlisted || 0 },
        { name: "Interview", value: analytics.applicationsByStatus.interview || 0 },
        { name: "Offer", value: analytics.applicationsByStatus.offer || 0 },
        { name: "Rejected", value: analytics.applicationsByStatus.rejected || 0 },
      ]
    : [];

  const funnelData = pipelineData.filter((d) => d.value > 0);

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Hiring metrics and insights</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 w-full rounded-lg" />
            <Skeleton className="h-80 w-full rounded-lg" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Jobs", value: analytics?.totalJobs ?? 0 },
                { label: "Active Jobs", value: analytics?.activeJobs ?? 0 },
                { label: "Total Applications", value: analytics?.totalApplications ?? 0 },
                { label: "Offer Rate", value: analytics?.totalApplications
                    ? `${Math.round(((analytics?.applicationsByStatus?.offer ?? 0) / analytics.totalApplications) * 100)}%`
                    : "0%" },
              ].map((s) => (
                <Card key={s.label} className="border-card-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
                    <p className="text-xl font-bold font-display">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline Funnel */}
              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Pipeline Funnel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pipelineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={pipelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 18%, 18%)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(210, 10%, 55%)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(210, 10%, 55%)" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(222, 24%, 11%)",
                            border: "1px solid hsl(222, 18%, 18%)",
                            borderRadius: "8px",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {pipelineData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">No data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card className="border-card-border">
                <CardHeader>
                  <CardTitle className="font-display text-base">Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {funnelData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={funnelData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={50}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {funnelData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(222, 24%, 11%)",
                            border: "1px solid hsl(222, 18%, 18%)",
                            borderRadius: "8px",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">No data available</p>
                  )}
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {pipelineData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                        {d.name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppSidebar>
  );
}
