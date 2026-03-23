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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Users, Send, Mail, Clock } from "lucide-react";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
  viewer: "Viewer",
};

export default function EmployerTeam() {
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("recruiter");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/employer/team"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/employer/team");
      return res.json();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      await authFetch("POST", "/api/employer/team/invite", {
        email: inviteEmail,
        role: inviteRole,
      });
    },
    onSuccess: () => {
      toast({ title: "Invite sent", description: `Invitation sent to ${inviteEmail}` });
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/employer/team"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    inviteMutation.mutate();
  };

  return (
    <AppSidebar>
      <div className="p-6 lg:p-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold" data-testid="text-page-title">
            Team
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your hiring team</p>
        </div>

        {/* Invite Form */}
        <Card className="border-card-border mb-6">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Mail className="h-4 w-4" /> Invite Team Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Email</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  data-testid="input-invite-email"
                  className="bg-background"
                />
              </div>
              <div className="w-40 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger data-testid="select-invite-role" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="recruiter">Recruiter</SelectItem>
                    <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-send-invite">
                <Send className="h-4 w-4 mr-2" />
                {inviteMutation.isPending ? "Sending..." : "Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card className="border-card-border mb-6">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Team Members
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !data?.members || data.members.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No team members yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((m: any) => (
                    <TableRow key={m.id} data-testid={`row-member-${m.id}`}>
                      <TableCell className="font-medium">{m.user?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{m.user?.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{roleLabels[m.role] || m.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending Invites */}
        {data?.invites && data.invites.length > 0 && (
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Pending Invites
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invites.map((inv: any) => (
                    <TableRow key={inv.id} data-testid={`row-invite-${inv.id}`}>
                      <TableCell className="text-sm">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{roleLabels[inv.role] || inv.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppSidebar>
  );
}
