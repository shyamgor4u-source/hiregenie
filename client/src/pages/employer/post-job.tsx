import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, X, Send } from "lucide-react";

export default function PostJob() {
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [type, setType] = useState("full_time");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      await authFetch("POST", "/api/jobs", {
        title,
        description,
        skills: JSON.stringify(skills),
        salaryMin: salaryMin ? Number(salaryMin) : null,
        salaryMax: salaryMax ? Number(salaryMax) : null,
        type,
        location,
        remote,
        status: "active",
      });
    },
    onSuccess: () => {
      toast({ title: "Job posted!", description: "Your job listing is now live" });
      queryClient.invalidateQueries({ queryKey: ["/api/employer/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employer/analytics"] });
      navigate("/employer/jobs");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast({ title: "Error", description: "Title and description are required", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            Post a Job
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create a new job listing</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="border-card-border mb-6">
            <CardHeader>
              <CardTitle className="font-display text-base">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Job Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Full-Stack Engineer"
                  data-testid="input-job-title"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  data-testid="input-job-description"
                  className="bg-background"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Job Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger data-testid="select-job-type" className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Location</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. San Francisco, CA"
                    data-testid="input-job-location"
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Salary Min</Label>
                  <Input
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="e.g. 120000"
                    data-testid="input-salary-min"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Salary Max</Label>
                  <Input
                    type="number"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="e.g. 180000"
                    data-testid="input-salary-max"
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={remote}
                  onCheckedChange={setRemote}
                  data-testid="switch-remote"
                />
                <Label className="text-sm">Remote friendly</Label>
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card className="border-card-border mb-6">
            <CardHeader>
              <CardTitle className="font-display text-base">Required Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill}
                    <button onClick={() => setSkills(skills.filter((s) => s !== skill))} className="ml-1 hover:text-destructive">
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
                  data-testid="input-job-skill"
                  className="bg-background"
                />
                <Button type="button" variant="secondary" size="sm" onClick={addSkill} data-testid="button-add-skill">
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            disabled={createMutation.isPending}
            data-testid="button-submit-job"
          >
            <Send className="h-4 w-4 mr-2" />
            {createMutation.isPending ? "Posting..." : "Post Job"}
          </Button>
        </form>
      </div>
    </AppSidebar>
  );
}
