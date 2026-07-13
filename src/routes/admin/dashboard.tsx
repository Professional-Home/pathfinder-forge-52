import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Users,
  GraduationCap,
  Calendar,
  FileText,
  Plus,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { AdminCard } from "@/components/admin/admin-shared";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  DASHBOARD_STATS,
  ENROLLMENT_CHART_DATA,
  INITIAL_COURSES,
  INITIAL_ENROLLMENTS,
  INITIAL_SESSIONS,
} from "@/lib/adminMockData";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardPage,
});

const chartConfig = {
  enrollments: { label: "Enrollments", color: "var(--student)" },
};

function AdminDashboardPage() {
  const recentEnrollments = INITIAL_ENROLLMENTS.slice(0, 4);
  const latestCourses = INITIAL_COURSES.slice(0, 3);
  const upcomingSessions = INITIAL_SESSIONS.filter((s) => s.status === "upcoming").slice(0, 3);

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="Overview of courses, students, mentors, and guidance sessions."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Dashboard" },
        ]}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DashboardCard title="Total Courses" value={DASHBOARD_STATS.totalCourses} icon={BookOpen} trend="+2 this month" />
        <DashboardCard title="Published" value={DASHBOARD_STATS.publishedCourses} icon={FileText} />
        <DashboardCard title="Draft Courses" value={DASHBOARD_STATS.draftCourses} icon={FileText} />
        <DashboardCard title="Total Students" value={DASHBOARD_STATS.totalStudents.toLocaleString()} icon={GraduationCap} trend="+12% vs last month" />
        <DashboardCard title="Total Mentors" value={DASHBOARD_STATS.totalMentors} icon={Users} />
        <DashboardCard title="Upcoming Sessions" value={DASHBOARD_STATS.upcomingSessions} icon={Calendar} />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <AdminCard title="Enrollment trends" hint="Last 6 months">
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={ENROLLMENT_CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickLine={false} axisLine={false} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="enrollments" fill="var(--student)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </AdminCard>

        <AdminCard
          title="Quick actions"
          hint="Common admin tasks"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/admin/courses">
              <Button variant="outline" className="h-auto w-full justify-start gap-3 border-border py-3">
                <Plus className="h-4 w-4" />
                <div className="text-left">
                  <div className="text-sm font-medium">Add Course</div>
                  <div className="text-xs text-muted-foreground">Create new course</div>
                </div>
              </Button>
            </Link>
            <Link to="/admin/mentors">
              <Button variant="outline" className="h-auto w-full justify-start gap-3 border-border py-3">
                <Users className="h-4 w-4" />
                <div className="text-left">
                  <div className="text-sm font-medium">Add Mentor</div>
                  <div className="text-xs text-muted-foreground">Onboard mentor</div>
                </div>
              </Button>
            </Link>
            <Link to="/admin/guidance">
              <Button variant="outline" className="h-auto w-full justify-start gap-3 border-border py-3">
                <Calendar className="h-4 w-4" />
                <div className="text-left">
                  <div className="text-sm font-medium">Schedule Session</div>
                  <div className="text-xs text-muted-foreground">Book guidance</div>
                </div>
              </Button>
            </Link>
            <Link to="/admin/enrollments">
              <Button variant="outline" className="h-auto w-full justify-start gap-3 border-border py-3">
                <TrendingUp className="h-4 w-4" />
                <div className="text-left">
                  <div className="text-sm font-medium">View Enrollments</div>
                  <div className="text-xs text-muted-foreground">Track progress</div>
                </div>
              </Button>
            </Link>
          </div>
        </AdminCard>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <AdminCard title="Recent enrollments" className="lg:col-span-1">
          {recentEnrollments.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
              <div>
                <div className="text-sm font-medium">{e.studentName}</div>
                <div className="text-xs text-muted-foreground">{e.courseName}</div>
              </div>
              <StatusBadge status={e.status} />
            </div>
          ))}
          <Link to="/admin/enrollments" className="mt-4 inline-flex items-center gap-1 text-xs text-foreground">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </AdminCard>

        <AdminCard title="Latest courses" className="lg:col-span-1">
          {latestCourses.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
              <img src={c.thumbnail} alt={c.title} className="h-10 w-14 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.category} · {c.duration}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
          <Link to="/admin/courses" className="mt-4 inline-flex items-center gap-1 text-xs text-foreground">
            Manage courses <ArrowRight className="h-3 w-3" />
          </Link>
        </AdminCard>

        <AdminCard title="Upcoming sessions" className="lg:col-span-1">
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
          <Link to="/admin/guidance" className="mt-4 inline-flex items-center gap-1 text-xs text-foreground">
            Manage sessions <ArrowRight className="h-3 w-3" />
          </Link>
        </AdminCard>
      </div>
    </>
  );
}
