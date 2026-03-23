import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, CheckCircle, XCircle, Users } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  closed: "bg-destructive/10 text-destructive border-destructive/20",
  draft: "bg-muted text-muted-foreground border-border",
};

export default function AdminJobs() {
  const { authFetch } = useAuth();
  const { toast } = useToast();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["/api/admin/jobs"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/admin/jobs");
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await authFetch("PUT", `/api/admin/jobs/${id}/status`, { status });
    },
    onSuccess: () => {
      toast({ title: "Job status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Moderate job listings</p>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !jobs || jobs.length === 0 ? (
              <div className="p-12 text-center">
                <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No jobs found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Applicants</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job: any) => (
                    <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.company?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" /> {job.applicationCount ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[job.status] || ""}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {job.status !== "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => statusMutation.mutate({ id: job.id, status: "active" })}
                              className="text-green-600 hover:text-green-700"
                              data-testid={`button-activate-${job.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Activate
                            </Button>
                          )}
                          {job.status !== "closed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => statusMutation.mutate({ id: job.id, status: "closed" })}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-close-${job.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Close
                            </Button>
                          )}
                        </div>
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
