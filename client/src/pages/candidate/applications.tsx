import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Building2 } from "lucide-react";

const statusColors: Record<string, string> = {
  applied: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  shortlisted: "bg-primary/10 text-primary border-primary/20",
  interview: "bg-accent/10 text-accent border-accent/20",
  offer: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function CandidateApplications() {
  const { authFetch } = useAuth();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["/api/candidates/applications"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/candidates/applications");
      return res.json();
    },
  });

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            My Applications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track your submitted applications</p>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !applications || applications.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No applications yet</p>
                <p className="text-xs text-muted-foreground mt-1">Browse jobs to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app: any) => (
                    <TableRow key={app.id} data-testid={`row-application-${app.id}`}>
                      <TableCell className="font-medium">{app.job?.title || "Unknown Job"}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          {app.company?.name || "Unknown Company"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[app.status] || ""}
                          data-testid={`badge-status-${app.id}`}
                        >
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppSidebar>
  );
}
