import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Brain, ArrowRight, ArrowLeft, MessageSquare, Mail, User, Sparkles } from "lucide-react";

const stages = ["applied", "shortlisted", "interview", "offer", "rejected"] as const;

const stageLabels: Record<string, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

const stageColors: Record<string, string> = {
  applied: "border-t-blue-500",
  shortlisted: "border-t-primary",
  interview: "border-t-accent",
  offer: "border-t-green-500",
  rejected: "border-t-destructive",
};

export default function EmployerPipeline() {
  const [, params] = useRoute("/employer/pipeline/:jobId");
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const jobId = params?.jobId;

  // If no jobId, show job selection
  const { data: jobs } = useQuery({
    queryKey: ["/api/employer/jobs"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/employer/jobs");
      return res.json();
    },
    enabled: !jobId,
  });

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ["/api/employer/pipeline", jobId],
    queryFn: async () => {
      const res = await authFetch("GET", `/api/employer/pipeline/${jobId}`);
      return res.json();
    },
    enabled: !!jobId,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ appId, status }: { appId: number; status: string }) => {
      await authFetch("PUT", `/api/employer/pipeline/${appId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/pipeline", jobId] });
      toast({ title: "Moved", description: "Candidate moved to new stage" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const shortlistMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("POST", `/api/ai/shortlist/${jobId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/pipeline", jobId] });
      toast({ title: "AI Shortlist Complete", description: "Candidates ranked by AI" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // No jobId — show selection
  if (!jobId) {
    return (
      <AppSidebar>
        <div className="p-6 lg:p-8 max-w-4xl">
          <h1 className="font-display text-xl font-bold mb-6" data-testid="text-page-title">
            Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mb-4">Select a job to view its pipeline:</p>
          {!jobs || jobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No jobs posted yet</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job: any) => (
                <Link key={job.id} href={`/employer/pipeline/${job.id}`}>
                  <Card className="border-card-border cursor-pointer hover:border-primary/30 transition-colors" data-testid={`card-select-job-${job.id}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.applicationCount ?? 0} applicants</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppSidebar>
    );
  }

  const grouped = stages.reduce(
    (acc, stage) => {
      acc[stage] = (pipeline || []).filter((app: any) => app.status === stage);
      return acc;
    },
    {} as Record<string, any[]>
  );

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/employer/pipeline")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
                Pipeline
              </h1>
              <p className="text-sm text-muted-foreground">Manage candidates for this position</p>
            </div>
          </div>
          <Button
            onClick={() => shortlistMutation.mutate()}
            disabled={shortlistMutation.isPending}
            variant="outline"
            className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
            data-testid="button-ai-shortlist"
          >
            <Brain className="h-4 w-4 mr-2" />
            {shortlistMutation.isPending ? "Ranking..." : "AI Shortlist"}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-5 gap-4">
            {stages.map((s) => (
              <Skeleton key={s} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 min-h-[400px]">
            {stages.map((stage) => (
              <div key={stage} className="flex flex-col">
                <div className={`rounded-t-lg border-t-4 ${stageColors[stage]} bg-card p-3 border border-card-border border-t-0`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {stageLabels[stage]}
                    </h3>
                    <Badge variant="secondary" className="text-xs h-5 min-w-5 flex items-center justify-center">
                      {grouped[stage]?.length || 0}
                    </Badge>
                  </div>
                </div>
                <div className="flex-1 bg-muted/30 border border-t-0 border-card-border rounded-b-lg p-2 space-y-2 min-h-[200px]">
                  {grouped[stage]?.map((app: any) => (
                    <PipelineCard
                      key={app.id}
                      app={app}
                      stage={stage}
                      onMove={(status) => moveMutation.mutate({ appId: app.id, status })}
                      authFetch={authFetch}
                      jobId={jobId}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppSidebar>
  );
}

function PipelineCard({
  app,
  stage,
  onMove,
  authFetch,
  jobId,
}: {
  app: any;
  stage: string;
  onMove: (status: string) => void;
  authFetch: any;
  jobId: string;
}) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [emailType, setEmailType] = useState("shortlist");
  const [generatedEmail, setGeneratedEmail] = useState<any>(null);

  const noteMutation = useMutation({
    mutationFn: async () => {
      await authFetch("POST", `/api/employer/notes/${app.id}`, { notes });
    },
    onSuccess: () => {
      setNotes("");
      toast({ title: "Note added" });
      queryClient.invalidateQueries({ queryKey: ["/api/employer/pipeline", jobId] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("POST", "/api/ai/outreach", {
        candidateId: app.candidateId,
        jobId: Number(jobId),
        type: emailType,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedEmail(data);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const nextStages = stages.filter((s) => s !== stage);

  return (
    <Card className="border-card-border bg-card" data-testid={`pipeline-card-${app.id}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {app.candidate?.name?.charAt(0) || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{app.candidate?.name || "Unknown"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{app.candidate?.email}</p>
          </div>
        </div>

        {app.aiScore && (
          <div className="flex items-center gap-1 mb-2">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-medium text-primary">Score: {app.aiScore}</span>
          </div>
        )}

        {/* Move Buttons */}
        <div className="flex flex-wrap gap-1 mb-2">
          {nextStages.slice(0, 2).map((s) => (
            <Button
              key={s}
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => onMove(s)}
              data-testid={`button-move-${app.id}-${s}`}
            >
              → {stageLabels[s]}
            </Button>
          ))}
        </div>

        {/* Notes Dialog */}
        <div className="flex gap-1">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2">
                <MessageSquare className="h-3 w-3 mr-1" /> Notes
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Notes for {app.candidate?.name}</DialogTitle>
              </DialogHeader>
              {app.notes && (
                <div className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap mb-3 max-h-40 overflow-y-auto">
                  {app.notes}
                </div>
              )}
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                data-testid={`input-notes-${app.id}`}
              />
              <Button
                size="sm"
                onClick={() => noteMutation.mutate()}
                disabled={noteMutation.isPending || !notes}
                data-testid={`button-save-notes-${app.id}`}
              >
                {noteMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </DialogContent>
          </Dialog>

          {/* Email Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2">
                <Mail className="h-3 w-3 mr-1" /> Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">Generate Email</DialogTitle>
              </DialogHeader>
              <Select value={emailType} onValueChange={setEmailType}>
                <SelectTrigger data-testid={`select-email-type-${app.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shortlist">Shortlist</SelectItem>
                  <SelectItem value="interview">Interview Invite</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
                  <SelectItem value="rejection">Rejection</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => emailMutation.mutate()}
                disabled={emailMutation.isPending}
                variant="outline"
                className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                data-testid={`button-generate-email-${app.id}`}
              >
                <Brain className="h-4 w-4 mr-2" />
                {emailMutation.isPending ? "Generating..." : "Generate Email"}
              </Button>
              {generatedEmail && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-xs font-bold">Subject: {generatedEmail.subject}</p>
                  <p className="text-xs whitespace-pre-wrap">{generatedEmail.body}</p>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
