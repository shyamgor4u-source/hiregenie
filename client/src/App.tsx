import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";

// Pages
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import CandidateDashboard from "@/pages/candidate/dashboard";
import CandidateJobs from "@/pages/candidate/jobs";
import CandidateApplications from "@/pages/candidate/applications";
import CandidateProfile from "@/pages/candidate/profile";
import CandidateAIInsights from "@/pages/candidate/ai-insights";
import EmployerDashboard from "@/pages/employer/dashboard";
import PostJob from "@/pages/employer/post-job";
import EmployerJobs from "@/pages/employer/jobs";
import EmployerPipeline from "@/pages/employer/pipeline";
import EmployerTeam from "@/pages/employer/team";
import EmployerAnalytics from "@/pages/employer/analytics";
import EmployerInterviews from "@/pages/employer/interviews";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminCompanies from "@/pages/admin/companies";
import AdminJobs from "@/pages/admin/jobs";

function ProtectedRoute({
  component: Component,
  roles,
}: {
  component: React.ComponentType;
  roles?: string[];
}) {
  const { user } = useAuth();

  if (!user) {
    return <Redirect to="/" />;
  }

  if (roles && !roles.includes(user.role)) {
    // Redirect to their proper dashboard
    const dest =
      user.role === "admin"
        ? "/admin/dashboard"
        : user.role === "employer"
          ? "/employer/dashboard"
          : "/candidate/dashboard";
    return <Redirect to={dest} />;
  }

  return <Component />;
}

function AppRouter() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />

      {/* Candidate */}
      <Route path="/candidate/dashboard">
        {() => <ProtectedRoute component={CandidateDashboard} roles={["candidate"]} />}
      </Route>
      <Route path="/candidate/jobs">
        {() => <ProtectedRoute component={CandidateJobs} roles={["candidate"]} />}
      </Route>
      <Route path="/candidate/applications">
        {() => <ProtectedRoute component={CandidateApplications} roles={["candidate"]} />}
      </Route>
      <Route path="/candidate/profile">
        {() => <ProtectedRoute component={CandidateProfile} roles={["candidate"]} />}
      </Route>
      <Route path="/candidate/ai">
        {() => <ProtectedRoute component={CandidateAIInsights} roles={["candidate"]} />}
      </Route>

      {/* Employer */}
      <Route path="/employer/dashboard">
        {() => <ProtectedRoute component={EmployerDashboard} roles={["employer"]} />}
      </Route>
      <Route path="/employer/post-job">
        {() => <ProtectedRoute component={PostJob} roles={["employer"]} />}
      </Route>
      <Route path="/employer/jobs">
        {() => <ProtectedRoute component={EmployerJobs} roles={["employer"]} />}
      </Route>
      <Route path="/employer/pipeline/:jobId">
        {() => <ProtectedRoute component={EmployerPipeline} roles={["employer"]} />}
      </Route>
      <Route path="/employer/pipeline">
        {() => <ProtectedRoute component={EmployerPipeline} roles={["employer"]} />}
      </Route>
      <Route path="/employer/team">
        {() => <ProtectedRoute component={EmployerTeam} roles={["employer"]} />}
      </Route>
      <Route path="/employer/analytics">
        {() => <ProtectedRoute component={EmployerAnalytics} roles={["employer"]} />}
      </Route>
      <Route path="/employer/interviews">
        {() => <ProtectedRoute component={EmployerInterviews} roles={["employer"]} />}
      </Route>

      {/* Admin */}
      <Route path="/admin/dashboard">
        {() => <ProtectedRoute component={AdminDashboard} roles={["admin"]} />}
      </Route>
      <Route path="/admin/users">
        {() => <ProtectedRoute component={AdminUsers} roles={["admin"]} />}
      </Route>
      <Route path="/admin/companies">
        {() => <ProtectedRoute component={AdminCompanies} roles={["admin"]} />}
      </Route>
      <Route path="/admin/jobs">
        {() => <ProtectedRoute component={AdminJobs} roles={["admin"]} />}
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
