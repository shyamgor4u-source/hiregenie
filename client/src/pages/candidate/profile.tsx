import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { User, Save, Brain, Plus, X } from "lucide-react";

export default function CandidateProfile() {
  const { authFetch } = useAuth();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/candidates/profile"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/candidates/profile");
      return res.json();
    },
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [desiredRole, setDesiredRole] = useState("");
  const [desiredSalary, setDesiredSalary] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [resumeText, setResumeText] = useState("");

  useEffect(() => {
    if (data) {
      setName(data.user?.name || "");
      setPhone(data.user?.phone || "");
      setSummary(data.profile?.summary || "");
      setDesiredRole(data.profile?.desiredRole || "");
      setDesiredSalary(data.profile?.desiredSalary || "");
      setLocation(data.profile?.location || "");
      setResumeText(data.profile?.resumeText || "");
      try {
        const s = data.profile?.skills ? JSON.parse(data.profile.skills) : [];
        setSkills(s);
      } catch { setSkills([]); }
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await authFetch("PUT", "/api/candidates/profile", {
        name,
        phone,
        summary,
        desiredRole,
        desiredSalary,
        location,
        skills,
        resumeText,
      });
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your changes have been saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates/profile"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const parseMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("POST", "/api/ai/parse-resume", { resumeText });
      return res.json();
    },
    onSuccess: (parsed: any) => {
      if (parsed.skills) setSkills(parsed.skills);
      if (parsed.summary) setSummary(parsed.summary);
      toast({ title: "Resume parsed!", description: "AI extracted your profile data" });
    },
    onError: (err: any) => {
      toast({ title: "Parse failed", description: err.message, variant: "destructive" });
    },
  });

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            My Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your candidate profile</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Strength */}
            <Card className="border-card-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Profile Strength</p>
                  <p className="text-sm font-bold text-primary">{data?.profile?.profileStrength || 0}%</p>
                </div>
                <Progress value={data?.profile?.profileStrength || 0} className="h-2" />
              </CardContent>
            </Card>

            {/* Basic Info */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <User className="h-4 w-4" /> Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-profile-name" className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-profile-phone" className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Desired Role</Label>
                    <Input value={desiredRole} onChange={(e) => setDesiredRole(e.target.value)} data-testid="input-desired-role" className="bg-background" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Desired Salary</Label>
                    <Input value={desiredSalary} onChange={(e) => setDesiredSalary(e.target.value)} data-testid="input-desired-salary" className="bg-background" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Location</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} data-testid="input-location" className="bg-background" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Summary</Label>
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={3}
                    data-testid="input-summary"
                    className="bg-background"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle className="font-display text-base">Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="gap-1">
                      {skill}
                      <button onClick={() => removeSkill(skill)} className="ml-1 hover:text-destructive" data-testid={`button-remove-skill-${skill}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a skill..."
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    data-testid="input-new-skill"
                    className="bg-background"
                  />
                  <Button variant="secondary" size="sm" onClick={addSkill} data-testid="button-add-skill">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resume Text & AI Parser */}
            <Card className="border-card-border">
              <CardHeader>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" /> AI Resume Parser
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={6}
                  placeholder="Paste your resume text here for AI parsing..."
                  data-testid="input-resume-text"
                  className="bg-background"
                />
                <Button
                  variant="outline"
                  onClick={() => parseMutation.mutate()}
                  disabled={parseMutation.isPending || !resumeText}
                  className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                  data-testid="button-parse-resume"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  {parseMutation.isPending ? "Parsing..." : "Parse with AI"}
                </Button>
              </CardContent>
            </Card>

            {/* Save */}
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full"
              data-testid="button-save-profile"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        )}
      </div>
    </AppSidebar>
  );
}
