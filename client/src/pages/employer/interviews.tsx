import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Video, Phone, MapPin, Clock } from "lucide-react";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const typeIcons: Record<string, any> = {
  video: Video,
  phone: Phone,
  onsite: MapPin,
};

export default function EmployerInterviews() {
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("60");
  const [interviewType, setInterviewType] = useState("video");
  const [interviewNotes, setInterviewNotes] = useState("");

  const { data: interviews, isLoading } = useQuery({
    queryKey: ["/api/employer/interviews"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/employer/interviews");
      return res.json();
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      await authFetch("POST", "/api/employer/interviews", {
        applicationId: Number(appId),
        scheduledAt,
        duration: Number(duration),
        type: interviewType,
        notes: interviewNotes || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Interview scheduled", description: "The interview has been added" });
      setOpen(false);
      setAppId("");
      setScheduledAt("");
      setInterviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/employer/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employer/analytics"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
              Interviews
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage scheduled interviews</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-schedule-interview">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Interview
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Schedule Interview</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Application ID
                  </Label>
                  <Input
                    type="number"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="e.g. 1"
                    data-testid="input-app-id"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Date & Time
                  </Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    data-testid="input-scheduled-at"
                    className="bg-background"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Duration (min)
                    </Label>
                    <Input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      data-testid="input-duration"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Type
                    </Label>
                    <Select value={interviewType} onValueChange={setInterviewType}>
                      <SelectTrigger data-testid="select-interview-type" className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="onsite">On-site</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Notes
                  </Label>
                  <Input
                    value={interviewNotes}
                    onChange={(e) => setInterviewNotes(e.target.value)}
                    placeholder="Optional notes..."
                    data-testid="input-interview-notes"
                    className="bg-background"
                  />
                </div>
                <Button
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending || !appId || !scheduledAt}
                  className="w-full"
                  data-testid="button-confirm-schedule"
                >
                  {scheduleMutation.isPending ? "Scheduling..." : "Schedule"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !interviews || interviews.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No interviews scheduled</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interviews.map((iv: any) => {
                    const Icon = typeIcons[iv.type] || Video;
                    return (
                      <TableRow key={iv.id} data-testid={`row-interview-${iv.id}`}>
                        <TableCell className="font-medium">{iv.candidate?.name || "Unknown"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{iv.job?.title || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm">
                            <Icon className="h-3.5 w-3.5" />
                            {iv.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {iv.duration}min
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[iv.status] || ""}>
                            {iv.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppSidebar>
  );
}
