import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Users, MapPin, PlusCircle, ArrowRight } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  closed: "bg-destructive/10 text-destructive border-destructive/20",
  draft: "bg-muted text-muted-foreground border-border",
};

export default function EmployerJobs() {
  const { authFetch } = useAuth();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["/api/employer/jobs"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/employer/jobs");
      return res.json();
    },
  });

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
              My Jobs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your job listings</p>
          </div>
          <Link href="/employer/post-job">
            <Button data-testid="button-post-job">
              <PlusCircle className="h-4 w-4 mr-2" />
              Post Job
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-12 text-center">
              <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No jobs posted yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job: any) => (
              <Card key={job.id} className="border-card-border hover:border-primary/30 transition-colors" data-testid={`card-job-${job.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display font-semibold text-sm truncate">{job.title}</h3>
                        <Badge variant="outline" className={statusColors[job.status] || ""}>
                          {job.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {job.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {job.applicationCount ?? 0} applicants
                        </span>
                      </div>
                    </div>
                    <Link href={`/employer/pipeline/${job.id}`}>
                      <Button variant="ghost" size="sm" data-testid={`button-pipeline-${job.id}`}>
                        Pipeline <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppSidebar>
  );
}
