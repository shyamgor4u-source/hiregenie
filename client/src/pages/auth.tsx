import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ArrowRight, ArrowLeft } from "lucide-react";

export default function AuthPage() {
  const { register, user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Candidate form
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cPassword, setCPassword] = useState("");

  // Employer form
  const [eName, setEName] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [ePassword, setEPassword] = useState("");
  const [eCompany, setECompany] = useState("");
  const [eIndustry, setEIndustry] = useState("");

  if (user) {
    const dest =
      user.role === "admin"
        ? "/admin/dashboard"
        : user.role === "employer"
          ? "/employer/dashboard"
          : "/candidate/dashboard";
    navigate(dest);
    return null;
  }

  const handleCandidateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName || !cEmail || !cPassword) {
      toast({ title: "Error", description: "Name, email, and password are required", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await register({
        name: cName,
        email: cEmail,
        password: cPassword,
        phone: cPhone,
        role: "candidate",
      });
      toast({ title: "Welcome!", description: "Account created successfully" });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eName || !eEmail || !ePassword || !eCompany) {
      toast({ title: "Error", description: "Name, email, password, and company name are required", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await register({
        name: eName,
        email: eEmail,
        password: ePassword,
        phone: ePhone,
        role: "employer",
        companyName: eCompany,
        industry: eIndustry,
      });
      toast({ title: "Welcome!", description: "Employer account created successfully" });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Back to login */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 text-muted-foreground"
          onClick={() => navigate("/")}
          data-testid="button-back-to-login"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>

        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="h-7 w-7 text-primary" />
          <span className="font-display text-xl font-bold">Create Account</span>
        </div>

        <Card className="border-card-border">
          <CardContent className="p-6">
            <Tabs defaultValue="candidate">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="candidate" data-testid="tab-candidate">
                  Candidate
                </TabsTrigger>
                <TabsTrigger value="employer" data-testid="tab-employer">
                  Employer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="candidate">
                <form onSubmit={handleCandidateRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Full Name
                    </Label>
                    <Input
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder="John Doe"
                      data-testid="input-candidate-name"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Email
                    </Label>
                    <Input
                      type="email"
                      value={cEmail}
                      onChange={(e) => setCEmail(e.target.value)}
                      placeholder="john@example.com"
                      data-testid="input-candidate-email"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Phone
                    </Label>
                    <Input
                      value={cPhone}
                      onChange={(e) => setCPhone(e.target.value)}
                      placeholder="+1-555-0123"
                      data-testid="input-candidate-phone"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Password
                    </Label>
                    <Input
                      type="password"
                      value={cPassword}
                      onChange={(e) => setCPassword(e.target.value)}
                      placeholder="••••••••"
                      data-testid="input-candidate-password"
                      className="bg-background"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full font-medium"
                    disabled={isLoading}
                    data-testid="button-register-candidate"
                  >
                    {isLoading ? "Creating Account..." : "Create Candidate Account"}
                    {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="employer">
                <form onSubmit={handleEmployerRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Full Name
                    </Label>
                    <Input
                      value={eName}
                      onChange={(e) => setEName(e.target.value)}
                      placeholder="Jane Smith"
                      data-testid="input-employer-name"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Email
                    </Label>
                    <Input
                      type="email"
                      value={eEmail}
                      onChange={(e) => setEEmail(e.target.value)}
                      placeholder="jane@company.com"
                      data-testid="input-employer-email"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Phone
                    </Label>
                    <Input
                      value={ePhone}
                      onChange={(e) => setEPhone(e.target.value)}
                      placeholder="+1-555-0456"
                      data-testid="input-employer-phone"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Password
                    </Label>
                    <Input
                      type="password"
                      value={ePassword}
                      onChange={(e) => setEPassword(e.target.value)}
                      placeholder="••••••••"
                      data-testid="input-employer-password"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Company Name
                    </Label>
                    <Input
                      value={eCompany}
                      onChange={(e) => setECompany(e.target.value)}
                      placeholder="Acme Inc."
                      data-testid="input-employer-company"
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      Industry
                    </Label>
                    <Input
                      value={eIndustry}
                      onChange={(e) => setEIndustry(e.target.value)}
                      placeholder="Technology"
                      data-testid="input-employer-industry"
                      className="bg-background"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full font-medium"
                    disabled={isLoading}
                    data-testid="button-register-employer"
                  >
                    {isLoading ? "Creating Account..." : "Create Employer Account"}
                    {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <PerplexityAttribution />
      </div>
    </div>
  );
}
