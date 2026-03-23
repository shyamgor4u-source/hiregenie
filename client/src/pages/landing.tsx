import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  ArrowRight,
  Search,
  FileText,
  Mail,
} from "lucide-react";

export default function LandingPage() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

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

  const handleDemoLogin = async (email: string, password: string, label: string) => {
    setDemoLoading(label);
    try {
      await login(email, password);
      toast({ title: "Welcome!", description: `Logged in as ${label}` });
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Navbar ─── */}
      <nav className="w-full bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">HireGenie</span>
          </div>

          {/* Center Nav */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => navigate("/")}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Find Jobs
            </button>
            <button className="flex items-center gap-1.5 text-sm font-medium text-violet-700 bg-violet-50 px-4 py-1.5 rounded-full">
              <Sparkles className="h-3.5 w-3.5" />
              HireGenie Copilot
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              data-testid="nav-login"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 px-5 py-2 rounded-full transition-colors"
              data-testid="nav-signup"
            >
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-violet-200 bg-violet-50 mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-700">
              AI-Powered Hiring Platform for Modern Companies
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6 text-gray-900">
            Replace 70% of{" "}
            <br className="hidden sm:block" />
            <span className="text-violet-600">Recruiter Work.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            The intelligent assistant that helps recruiters hire faster by automating
            resume screening, candidate ranking, and outreach.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={() => navigate("/auth")}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-full transition-colors"
              data-testid="button-try-hiregenie"
            >
              Try HireGenie
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const jobsSection = document.getElementById("features-section");
                jobsSection?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-full border border-gray-300 transition-colors"
            >
              Browse Jobs
            </button>
          </div>

          {/* Demo Card */}
          <div className="max-w-md mx-auto bg-violet-50 border border-violet-200 rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-700 mb-4">
              Try the Demo
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-3">
              <button
                onClick={() => handleDemoLogin("candidate@hiregenie.com", "candidate123", "Candidate")}
                disabled={demoLoading !== null}
                className="w-full sm:w-auto flex-1 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-full border border-gray-300 transition-colors disabled:opacity-50"
                data-testid="button-demo-candidate"
              >
                {demoLoading === "Candidate" ? "Logging in..." : "Login as Candidate"}
              </button>
              <button
                onClick={() => handleDemoLogin("employer@hiregenie.com", "employer123", "Employer")}
                disabled={demoLoading !== null}
                className="w-full sm:w-auto flex-1 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-full transition-colors disabled:opacity-50"
                data-testid="button-demo-employer"
              >
                {demoLoading === "Employer" ? "Logging in..." : "Login as Employer"}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Use the Quick Login buttons on the login page for instant access.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Stats Strip ─── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "70%", label: "Faster Hiring" },
            { value: "10x", label: "Resume Processing" },
            { value: "3x", label: "More Candidates" },
            { value: "50%", label: "Cost Reduction" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Dark Feature Section — Why AI Copilot? ─── */}
      <section id="features-section" className="bg-gray-900 py-20 px-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
          {/* Left — features */}
          <div className="lg:w-1/2">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 italic font-serif">
              Why AI Copilot?
            </h2>

            <div className="space-y-8">
              {[
                {
                  icon: Search,
                  title: "Find Relevant Candidates",
                  desc: "Searches across sources like LinkedIn, GitHub, and developer communities to produce a ranked list.",
                },
                {
                  icon: FileText,
                  title: "AI Resume Screening",
                  desc: "Upload 100s of resumes and get instant fitment analysis. Save 3-4 hours per role.",
                },
                {
                  icon: Mail,
                  title: "Automatic Outreach",
                  desc: "Generate personalized messages for candidates instantly to increase response rates.",
                },
              ].map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <div className="flex-shrink-0 h-12 w-12 bg-violet-600/20 rounded-xl flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — dark card mockup */}
          <div className="lg:w-1/2 flex justify-center">
            <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-6 border border-gray-700">
              {/* Skeleton header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 bg-gray-600 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-700 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-700 rounded w-1/2" />
                </div>
              </div>

              {/* Skeleton lines */}
              <div className="space-y-3 mb-6">
                <div className="h-3 bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-700 rounded w-5/6" />
                <div className="h-3 bg-gray-700 rounded w-4/6" />
              </div>

              {/* Skills row */}
              <div className="flex gap-2 mb-6">
                <div className="h-6 bg-gray-700 rounded-full w-16" />
                <div className="h-6 bg-gray-700 rounded-full w-20" />
                <div className="h-6 bg-gray-700 rounded-full w-14" />
              </div>

              {/* Divider */}
              <div className="border-t border-gray-700 pt-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Match Score</p>
                  <p className="text-green-400 font-bold text-lg">94%</p>
                </div>
                <button className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                  Shortlist
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-gray-50 border-t border-gray-200 pt-12 pb-6 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            {/* Brand column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 bg-violet-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-lg font-bold text-gray-900">HireGenie</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                The AI-powered assistant for modern recruiters. Hire faster, smarter, and better.
              </p>
            </div>

            {/* Platform column */}
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3">Platform</h4>
              <ul className="space-y-2">
                {["Browse Jobs", "Companies", "Pricing"].map((link) => (
                  <li key={link}>
                    <span className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer transition-colors">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support column */}
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3">Support</h4>
              <ul className="space-y-2">
                {["Help Center", "Contact Us", "Privacy Policy"].map((link) => (
                  <li key={link}>
                    <span className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer transition-colors">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 pt-6 text-center">
            <p className="text-xs text-gray-400">&copy; 2026 HireGenie. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <PerplexityAttribution />
    </div>
  );
}
