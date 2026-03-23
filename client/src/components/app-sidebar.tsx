import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  FileText,
  User,
  Brain,
  PlusCircle,
  Briefcase,
  Kanban,
  Users,
  BarChart3,
  Calendar,
  Building2,
  Shield,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const candidateNav: NavItem[] = [
  { label: "Dashboard", href: "/candidate/dashboard", icon: LayoutDashboard },
  { label: "Find Jobs", href: "/candidate/jobs", icon: Search },
  { label: "My Applications", href: "/candidate/applications", icon: FileText },
  { label: "My Profile", href: "/candidate/profile", icon: User },
  { label: "AI Insights", href: "/candidate/ai", icon: Brain },
];

const employerNav: NavItem[] = [
  { label: "Dashboard", href: "/employer/dashboard", icon: LayoutDashboard },
  { label: "Post Job", href: "/employer/post-job", icon: PlusCircle },
  { label: "My Jobs", href: "/employer/jobs", icon: Briefcase },
  { label: "Pipeline", href: "/employer/pipeline", icon: Kanban },
  { label: "Team", href: "/employer/team", icon: Users },
  { label: "Analytics", href: "/employer/analytics", icon: BarChart3 },
  { label: "Interviews", href: "/employer/interviews", icon: Calendar },
];

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Companies", href: "/admin/companies", icon: Building2 },
  { label: "Jobs", href: "/admin/jobs", icon: Briefcase },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems =
    user?.role === "admin"
      ? adminNav
      : user?.role === "employer"
        ? employerNav
        : candidateNav;

  const roleLabel =
    user?.role === "admin"
      ? "Admin"
      : user?.role === "employer"
        ? "Employer"
        : "Candidate";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 shrink-0",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border shrink-0">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="font-display text-lg font-bold tracking-tight text-sidebar-foreground">
                HireGenie
              </span>
            </Link>
          )}
          {collapsed && (
            <Link href="/" className="mx-auto">
              <Sparkles className="h-6 w-6 text-primary" />
            </Link>
          )}
        </div>

        {/* User Info */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <p className="text-sm font-medium text-sidebar-foreground truncate" data-testid="text-username">
              {user?.name}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="text-user-role">
              {roleLabel}
            </p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer mb-0.5",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-sidebar-border p-2 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-full justify-start gap-3 text-sidebar-foreground"
            data-testid="button-toggle-theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed && (theme === "dark" ? "Light Mode" : "Dark Mode")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-start gap-3 text-sidebar-foreground"
            data-testid="button-toggle-sidebar"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </Button>
          <Separator className="my-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start gap-3 text-destructive hover:text-destructive"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Logout"}
          </Button>
          {!collapsed && <PerplexityAttribution />}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
