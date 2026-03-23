import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Brain, Target, TrendingUp, ArrowRight, AlertTriangle, CheckCircle, Lightbulb } from "lucide-react";

export default function CandidateAIInsights() {
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [skillGap, setSkillGap] = useState<any>(null);
  const [jobMatches, setJobMatches] = useState<any[]>([]);

  const skillGapMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("POST", "/api/ai/skill-gap");
      return res.json();
    },
    onSuccess: (data) => {
      setSkillGap(data);
      toast({ title: "Analysis complete", description: "Skill gap analysis ready" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const matchMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("POST", "/api/ai/match-jobs");
      return res.json();
    },
    onSuccess: (data) => {
      setJobMatches(data);
      toast({ title: "Matching complete", description: `Found ${data.length} job matches` });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const importanceColors: Record<string, string> = {
    High: "bg-destructive/10 text-destructive border-destructive/20",
    Medium: "bg-primary/10 text-primary border-primary/20",
    Low: "bg-muted text-muted-foreground border-border",
  };

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            AI Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered career analysis and job recommendations
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="border-card-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm">Skill Gap Analysis</h3>
                  <p className="text-xs text-muted-foreground">Identify skills to learn</p>
                </div>
              </div>
              <Button
                onClick={() => skillGapMutation.mutate()}
                disabled={skillGapMutation.isPending}
                variant="outline"
                className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                data-testid="button-skill-gap"
              >
                {skillGapMutation.isPending ? "Analyzing..." : "Run Analysis"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-card-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm">Job Matching</h3>
                  <p className="text-xs text-muted-foreground">Find best-fit roles</p>
                </div>
              </div>
              <Button
                onClick={() => matchMutation.mutate()}
                disabled={matchMutation.isPending}
                className="w-full"
                data-testid="button-match-jobs"
              >
                {matchMutation.isPending ? "Matching..." : "Find Matches"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Skill Gap Results */}
        {skillGap && (
          <div className="space-y-4 mb-8">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-accent" /> Skill Gap Analysis
            </h2>

            {/* Overall Assessment */}
            <Card className="border-card-border">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-chart-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium mb-1">Overall Assessment</p>
                    <p className="text-sm text-muted-foreground">{skillGap.overallAssessment}</p>
                    {skillGap.recommendedPath && (
                      <p className="text-xs text-primary mt-2 font-medium">
                        Career Path: {skillGap.recommendedPath}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Skills */}
            {skillGap.currentSkills?.length > 0 && (
              <Card className="border-card-border">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" /> Current Skills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {skillGap.currentSkills.map((skill: string) => (
                      <Badge key={skill} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gaps */}
            {skillGap.gaps?.length > 0 && (
              <Card className="border-card-border">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-primary" /> Skills to Develop
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {skillGap.gaps.map((gap: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50" data-testid={`gap-${i}`}>
                        <Badge variant="outline" className={importanceColors[gap.importance] || ""}>
                          {gap.importance}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{gap.skill}</p>
                          <p className="text-xs text-muted-foreground mt-1">{gap.recommendation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Job Match Results */}
        {jobMatches.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Job Matches
            </h2>

            {jobMatches.map((match: any, i: number) => (
              <Card key={i} className="border-card-border" data-testid={`card-match-${i}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-display font-semibold text-sm mb-1">
                        {match.job?.title || "Unknown"}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        {match.job?.company?.name || "Unknown Company"}
                      </p>
                      <p className="text-xs text-muted-foreground">{match.reasoning}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="relative h-14 w-14">
                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                          <circle
                            cx="28" cy="28" r="24" fill="none"
                            stroke="currentColor" strokeWidth="4"
                            className="text-primary"
                            strokeDasharray={`${(match.score / 100) * 150.8} 150.8`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                          {match.score}%
                        </span>
                      </div>
                    </div>
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
