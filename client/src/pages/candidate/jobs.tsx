import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, DollarSign, Briefcase, Wifi, Send } from "lucide-react";

export default function CandidateJobs() {
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/jobs");
      return res.json();
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (jobId: number) => {
      await authFetch("POST", `/api/candidates/apply/${jobId}`);
    },
    onSuccess: () => {
      toast({ title: "Applied!", description: "Application submitted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredJobs = (jobs || []).filter((job: any) => {
    const matchSearch =
      !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.description?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || job.type === typeFilter;
    return matchSearch && matchType && job.status === "active";
  });

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null;
    const fmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}/hr`);
    if (min && max) return `${fmt(min)} - ${fmt(max)}`;
    if (min) return `From ${fmt(min)}`;
    return `Up to ${fmt(max!)}`;
  };

  const typeLabels: Record<string, string> = {
    full_time: "Full Time",
    part_time: "Part Time",
    contract: "Contract",
    internship: "Internship",
  };

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            Find Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Browse open positions</p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card"
              data-testid="input-search-jobs"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] bg-card" data-testid="select-job-type">
              <SelectValue placeholder="Job Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="full_time">Full Time</SelectItem>
              <SelectItem value="part_time">Part Time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="internship">Internship</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Job List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-12 text-center">
              <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No jobs found matching your criteria</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job: any) => (
              <Card key={job.id} className="border-card-border hover:border-primary/30 transition-colors" data-testid={`card-job-${job.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display font-semibold text-base truncate">{job.title}</h3>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {typeLabels[job.type] || job.type}
                        </Badge>
                        {job.remote && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <Wifi className="h-3 w-3 mr-1" /> Remote
                          </Badge>
                        )}
                      </div>

                      {job.company && (
                        <p className="text-sm text-muted-foreground mb-2">{job.company.name}</p>
                      )}

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {job.description?.substring(0, 200)}...
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {job.location}
                          </span>
                        )}
                        {formatSalary(job.salaryMin, job.salaryMax) && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" /> {formatSalary(job.salaryMin, job.salaryMax)}
                          </span>
                        )}
                      </div>

                      {/* Skills */}
                      {job.skills && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {(typeof job.skills === "string" ? JSON.parse(job.skills) : job.skills).slice(0, 5).map((skill: string) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => applyMutation.mutate(job.id)}
                      disabled={applyMutation.isPending}
                      data-testid={`button-apply-${job.id}`}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Apply
                    </Button>
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
