import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  ArrowRight,
  FileSearch,
  Target,
  ListFilter,
  Mail,
  TrendingUp,
  Zap,
  Clock,
  CheckCircle2,
  Star,
  Quote,
} from "lucide-react";

export default function LandingPage() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Error", description: "Email and password are required", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      toast({ title: "Welcome back!", description: "Logged in successfully" });
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: FileSearch, title: "Resume Parser", desc: "AI extracts skills, experience & education from any resume" },
    { icon: Target, title: "Job Matching", desc: "Smart matching scores based on skills & experience alignment" },
    { icon: ListFilter, title: "AI Shortlisting", desc: "Automatically rank and shortlist top candidates" },
    { icon: Mail, title: "Email Generator", desc: "Auto-generate outreach emails for every hiring stage" },
    { icon: TrendingUp, title: "Skill Gap Analysis", desc: "Identify skill gaps and get learning recommendations" },
  ];

  const stats = [
    { value: "500+", label: "Matches Made", icon: Zap },
    { value: "10x", label: "Faster Hiring", icon: Clock },
    { value: "95%", label: "Match Accuracy", icon: CheckCircle2 },
  ];

  const testimonials = [
    {
      quote: "HireGenie reduced our time-to-hire from 45 days to just 8. The AI shortlisting is incredibly accurate.",
      author: "Sarah Chen",
      role: "Head of Talent, TechVista",
    },
    {
      quote: "The job matching feature found me a role that perfectly aligned with my skills. Couldn't be happier!",
      author: "Alex Rivera",
      role: "Senior Engineer",
    },
    {
      quote: "Managing our hiring pipeline has never been easier. The Kanban view and AI insights are game-changers.",
      author: "Michael Park",
      role: "VP Engineering, CloudNine",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section — Split Screen */}
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Left — Branding */}
        <div className="lg:w-[60%] flex flex-col justify-center px-8 lg:px-16 py-12 lg:py-0 bg-gradient-to-br from-background via-background to-muted">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-12">
            <Sparkles className="h-8 w-8 text-primary" />
            <span className="font-display text-2xl font-bold tracking-tight">HireGenie</span>
          </div>

          {/* Tagline */}
          <h1 className="font-display text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Hire in <span className="text-primary">Days</span>,{" "}
            <br className="hidden lg:block" />
            Not <span className="text-muted-foreground">Months</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg">
            AI-powered hiring platform that automates resume parsing, candidate matching,
            and pipeline management. Built for modern recruiting teams.
          </p>

          {/* Stats Row */}
          <div className="flex flex-wrap gap-6 mb-10">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 bg-card border border-card-border rounded-lg px-5 py-3"
                data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <stat.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xl font-bold font-display">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2">
            {features.map((f) => (
              <span
                key={f.title}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.title}
              </span>
            ))}
          </div>
        </div>

        {/* Right — Login Card */}
        <div className="lg:w-[40%] flex items-center justify-center p-8 lg:p-12 bg-card/50">
          <Card className="w-full max-w-md border-card-border bg-card">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h2 className="font-display text-xl font-bold mb-2">Welcome Back</h2>
                <p className="text-sm text-muted-foreground">Sign in to your account</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-email"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-password"
                    className="bg-background"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full font-medium"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? "Signing in..." : "Access Platform"}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-medium border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                  onClick={() => navigate("/auth")}
                  data-testid="button-goto-register"
                >
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground text-center mb-3">Demo Accounts</p>
                <div className="space-y-2">
                  {[
                    { label: "Admin", email: "admin@hiregenie.com", pass: "admin123" },
                    { label: "Employer", email: "employer@hiregenie.com", pass: "employer123" },
                    { label: "Candidate", email: "candidate@hiregenie.com", pass: "candidate123" },
                  ].map((demo) => (
                    <button
                      key={demo.label}
                      type="button"
                      onClick={() => {
                        setEmail(demo.email);
                        setPassword(demo.pass);
                      }}
                      className="w-full text-left px-3 py-2 text-xs rounded-md border border-border hover:border-primary/50 hover:bg-muted transition-colors"
                      data-testid={`button-demo-${demo.label.toLowerCase()}`}
                    >
                      <span className="font-medium">{demo.label}:</span>{" "}
                      <span className="text-muted-foreground">{demo.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Below Fold — Features */}
      <section className="py-20 px-8 lg:px-16 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl font-bold mb-3">Powered by AI, Built for Speed</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every step of the hiring process is enhanced by artificial intelligence,
              from parsing resumes to ranking candidates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="border-card-border hover:border-primary/30 transition-colors"
                data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardContent className="p-6">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-8 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl font-bold mb-3">What Our Users Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="border-card-border">
                <CardContent className="p-6">
                  <Quote className="h-5 w-5 text-primary/40 mb-3" />
                  <p className="text-sm text-foreground mb-4 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {t.author.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.author}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <PerplexityAttribution />
    </div>
  );
}
