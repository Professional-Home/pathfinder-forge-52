import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Users,
  GraduationCap,
  Calendar,
  FileText,
  Plus,
  TrendingUp,
} from "lucide-react";
import { AdminGreeting, AdminCard, AdminListRow, AdminLinkRow } from "@/components/admin/admin-shared";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  DASHBOARD_STATS,
  ENROLLMENT_CHART_DATA,
  INITIAL_SESSIONS,
} from "@/lib/adminMockData";
import { getAdminUser } from "@/lib/adminAuth";
import { supabase } from "@/utils/supabase";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardPage,
});

const chartConfig = {
  enrollments: { label: "Enrollments", color: "var(--student)" },
};

const quickActions = [
  { icon: Plus, label: "Add Course", desc: "Create new course", to: "/admin/courses", accent: "text-student bg-student/10" },
  { icon: Users, label: "Add Mentor", desc: "Onboard mentor", to: "/admin/mentors", accent: "text-startup bg-startup/10" },
  { icon: Calendar, label: "Schedule Session", desc: "Book guidance", to: "/admin/guidance", accent: "text-researcher bg-researcher/10" },
  { icon: TrendingUp, label: "View Enrollments", desc: "Track progress", to: "/admin/enrollments", accent: "text-student bg-student/10" },
];

function AdminDashboardPage() {
  const user = getAdminUser();
  const upcomingSessions = INITIAL_SESSIONS.filter((s) => s.status === "upcoming").slice(0, 3);

  const [userCount, setUserCount] = useState<number>(0);
  const [googleCount, setGoogleCount] = useState<number>(0);
  const [coursesCount, setCoursesCount] = useState<number>(0);
  const [mentorsCount, setMentorsCount] = useState<number>(0);
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);
  const [latestCourses, setLatestCourses] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      const [userRes, googleRes, courseRes, mentorRes, enrollmentsRes, latestCoursesRes] = await Promise.all([
        supabase.from("users").select("*", { count: 'exact', head: true }),
        supabase.rpc('get_google_user_count'),
        supabase.from("courses").select("*", { count: 'exact', head: true }),
        supabase.from("mentors").select("*", { count: 'exact', head: true }),
        supabase.from("enrollments").select("*, courses(title)").order("enrollment_date", { ascending: false }).limit(4),
        supabase.from("courses").select("*").order("created_at", { ascending: false }).limit(3)
      ]);

      if (!userRes.error) setUserCount(userRes.count || 0);
      if (!googleRes.error) setGoogleCount(googleRes.data || 0);
      if (!courseRes.error) setCoursesCount(courseRes.count || 0);
      if (!mentorRes.error) setMentorsCount(mentorRes.count || 0);
      if (enrollmentsRes.data) setRecentEnrollments(enrollmentsRes.data);
      if (latestCoursesRes.data) setLatestCourses(latestCoursesRes.data);
    }

    fetchDashboardData();
  }, []);


  return (
    <>
      <AdminGreeting
        title={`Welcome back, ${user.name}.`}
        sub="Here's what's happening across courses, students, mentors, and guidance."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
        <DashboardCard title="Total Courses" value={coursesCount.toString()} icon={BookOpen} trend="+2 this month" />
        {/* //<DashboardCard title="Published" value={DASHBOARD_STATS.publishedCourses} icon={FileText} accent="researcher" />
        <DashboardCard title="Draft Courses" value={DASHBOARD_STATS.draftCourses} icon={FileText} accent="startup" /> */}
        <DashboardCard title="Total Students" value={(userCount + googleCount).toLocaleString()} icon={GraduationCap} trend="+12% vs last month" />
        <DashboardCard title="Total Mentors" value={mentorsCount.toString()} icon={Users} accent="startup" />
        <DashboardCard title="Upcoming Sessions" value={DASHBOARD_STATS.upcomingSessions} icon={Calendar} accent="researcher" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <AdminCard title="Enrollment trends" hint="Last 6 months">
          <ChartContainer config={chartConfig} className="h-[220px] w-full sm:h-[260px]">
            <BarChart data={ENROLLMENT_CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickLine={false} axisLine={false} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="enrollments" fill="var(--student)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </AdminCard>

        <AdminCard title="Quick actions" hint="Common admin tasks">
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 transition hover:border-border-strong hover:shadow-sm"
              >
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${action.accent}`}>
                  <action.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </AdminCard>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <AdminCard title="Recent enrollments">
          {recentEnrollments.map((e) => (
            <AdminListRow
              key={e.id}
              primary={e.student_name}
              secondary={e.courses?.title || "—"}
            />
          ))}
          <AdminLinkRow label="View all enrollments" to="/admin/enrollments" />
        </AdminCard>

        <AdminCard title="Latest courses">
          {latestCourses.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
              <img src={c.thumbnail} alt={c.title} className="h-10 w-14 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.category} · {c.duration}</div>
              </div>
            </div>
          ))}
          <AdminLinkRow label="Manage courses" to="/admin/courses" />
        </AdminCard>

        <AdminCard title="Upcoming sessions">
          {upcomingSessions.map((s) => (
            <div key={s.id} className="border-b border-border/60 py-3 last:border-0">
              <div className="text-sm font-medium">{s.studentName}</div>
              <div className="text-xs text-muted-foreground">
                {s.courseName} with {s.mentorName}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.sessionDate} · {s.sessionTime}
              </div>
            </div>
          ))}
          <AdminLinkRow label="Manage sessions" to="/admin/guidance" />
        </AdminCard>
      </div>
    </>
  );
}
