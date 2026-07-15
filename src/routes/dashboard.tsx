import { createFileRoute, Link, Outlet, useLocation, redirect } from "@tanstack/react-router";
import {
  Bell, Search, LayoutDashboard, BookOpen, Users, GraduationCap as GradIcon,
  Award, Wallet, Settings, ArrowRight
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DOMAINS, type Domain, isDomain } from "@/lib/domain";
import { mockUser } from "@/lib/mockUser";
import { Rocket, Microscope, GraduationCap as GradIcon2 } from "lucide-react";
import { supabase } from "@/utils/supabase";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    // If we're coming back from an OAuth provider, give Supabase a moment to parse the hash
    if (location.hash.includes('access_token')) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({
        to: '/login',
      });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const user = { ...mockUser, lane: "student" as Domain };
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <div className="mx-auto flex flex-col lg:grid lg:max-w-[1400px] lg:grid-cols-[240px_1fr]">
        <div className="hidden lg:block">
          <Sidebar domain={user.lane} />
        </div>
        
        <div className="flex min-h-screen flex-col border-l border-border bg-background">
          <TopBar user={user} currentDomain={user.lane} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:py-6 md:px-8 md:py-10 lg:pb-10">
            <Outlet />
          </main>
          <MobileNav domain={user.lane} />
        </div>
      </div>
    </div>
  );
}

function Sidebar({ domain }: { domain: Domain }) {
  const d = DOMAINS[domain];
  const location = useLocation();
  const path = location.pathname;

  const nav = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
    { icon: BookOpen, label: "Guidance", to: "/dashboard/guidance" },
    { icon: Users, label: "Mentors", to: "/dashboard/mentors" },
    { icon: GradIcon, label: "Courses", to: "/dashboard/courses" },
    { icon: Award, label: "Certificates", to: "/dashboard/certificates" },
    { icon: Wallet, label: "Payments", to: "/dashboard/payments" },
    { icon: Settings, label: "Settings", to: "/dashboard/settings" },
  ];

  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-8 bg-surface p-6">
      <Wordmark />
      <div className={`rounded-xl border border-border bg-surface-elevated p-3`}>
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${d.dotClass}`} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your lane</span>
        </div>
        <div className="mt-1 font-display text-lg">{d.label}</div>
      </div>
      <nav className="flex flex-col gap-0.5 text-sm">
        {nav.map((n) => {
          const active = path.includes(n.to) && n.to !== "/dashboard" || (n.to === "/dashboard" && path === "/dashboard");
          return (
            <Link
              key={n.label}
              to={n.to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-left transition ${
                active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3 text-xs text-muted-foreground">
        <div className="rounded-lg border border-border bg-surface-elevated p-3">
          <div className="font-medium text-foreground">Re-take the quiz</div>
          <div className="mt-1">Your goals shift. Your path can too.</div>
          <Link to="/onboarding" className="mt-3 inline-flex items-center gap-1 text-foreground">
            Update <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ domain }: { domain: Domain }) {
  const location = useLocation();
  const path = location.pathname;

  const nav = [
    { icon: LayoutDashboard, label: "Home", to: "/dashboard" },
    { icon: BookOpen, label: "Guidance", to: "/dashboard/guidance" },
    { icon: Users, label: "Mentors", to: "/dashboard/mentors" },
    { icon: GradIcon, label: "Courses", to: "/dashboard/courses" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-background px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
      {nav.map((n) => {
        const active = path.includes(n.to) && n.to !== "/dashboard" || (n.to === "/dashboard" && path === "/dashboard");
        return (
          <Link
            key={n.label}
            to={n.to}
            className={`flex flex-col items-center gap-1.5 text-[10px] font-medium transition ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <n.icon className={`h-5 w-5 ${active ? "text-foreground" : "opacity-80"}`} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function TopBar({ user, currentDomain }: { user: any; currentDomain: Domain }) {
  const d = DOMAINS[currentDomain];
  const icons = { student: GradIcon2, startup: Rocket, researcher: Microscope };
  
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-4 md:px-8 bg-background sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className={`inline-flex items-center gap-2 rounded-full ${d.softBgClass} px-3 py-1 text-xs ${d.accentClass}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${d.dotClass}`} />
          <span className="hidden sm:inline">{d.label} · {currentDomain === "startup" ? "Seed stage" : currentDomain === "researcher" ? "Postdoc" : "Undergrad"}</span>
          <span className="sm:hidden">{d.label}</span>
        </div>
        
        <div className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground md:flex">
          <span className="h-2 w-2 rounded-full bg-student"></span>
          Student Area
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground md:flex">
          <Search className="h-3.5 w-3.5" /> Search mentors, courses, guidance
        </div>
        <button className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
        </button>
        <div className="h-8 w-8 rounded-full bg-foreground/90 grid place-items-center font-display text-sm text-background overflow-hidden border border-border">
          {session?.user?.user_metadata?.avatar_url ? (
            <img src={session.user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
          ) : session?.user?.user_metadata?.full_name ? (
            session.user.user_metadata.full_name.charAt(0).toUpperCase()
          ) : session?.user?.email ? (
            session.user.email.charAt(0).toUpperCase()
          ) : (
            user.avatar
          )}
        </div>
      </div>
    </header>
  );
}
