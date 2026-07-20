import { createFileRoute } from "@tanstack/react-router";
import { Play, Calendar, BookOpen, Users, Award, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import { mockUser, type User } from "@/lib/mockUser";
import { type Domain } from "@/lib/domain";
import { Card, Greeting, MentorRow, GuidanceRow } from "@/components/dashboard-shared";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/utils/supabase";
import { DOMAINS } from "@/lib/domain";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

function DashboardOverview() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profile").select("*").eq("id", user.id).single();
      return data || { name: user.email?.split("@")[0] || "User", email: user.email };
    }
  });

  // Fetch quick stats from Supabase
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;
      if (!userEmail) return { enrolledCount: 0, bookedCount: 0, certificateCount: 0 };

      const [enrollments, bookings] = await Promise.all([
        supabase.from("enrollments_users").select("id", { count: "exact" }).eq("student_email", userEmail),
        supabase.from("mentor_bookings").select("id", { count: "exact" }).eq("student_email", userEmail),
      ]);

      return {
        enrolledCount: enrollments.count ?? 0,
        bookedCount: bookings.count ?? 0,
        certificateCount: 0,
      };
    }
  });

  // Fetch recent activity
  const { data: recentActivity } = useQuery({
    queryKey: ["dashboard-recent-activity"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;
      if (!userEmail) return [];

      const [enrollments, bookings] = await Promise.all([
        supabase
          .from("enrollments_users")
          .select("course_id, enrolled_at, courses(title)")
          .eq("student_email", userEmail)
          .order("enrolled_at", { ascending: false })
          .limit(3),
        supabase
          .from("mentor_bookings")
          .select("mentor_id, booked_at, mentors(name)")
          .eq("student_email", userEmail)
          .order("booked_at", { ascending: false })
          .limit(3),
      ]);

      const items: { type: string; label: string; time: string; icon: string }[] = [];

      (enrollments.data || []).forEach((e: any) => {
        items.push({
          type: "enrollment",
          label: `Enrolled in ${e.courses?.title || "a course"}`,
          time: e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Recently",
          icon: "course",
        });
      });

      (bookings.data || []).forEach((b: any) => {
        items.push({
          type: "booking",
          label: `Booked ${b.mentors?.name || "a mentor"}`,
          time: b.booked_at ? new Date(b.booked_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Recently",
          icon: "mentor",
        });
      });

      // Sort by most recent
      items.sort((a, b) => (a.time > b.time ? -1 : 1));
      return items.slice(0, 5);
    }
  });

  const user = { 
    ...mockUser, 
    name: profile?.name || mockUser.name,
    lane: "student" as Domain 
  };

  const quickStats = [
    {
      label: "Courses Enrolled",
      value: stats?.enrolledCount ?? 0,
      icon: BookOpen,
      color: "text-student",
      bg: "bg-student/10",
    },
    {
      label: "Mentors Booked",
      value: stats?.bookedCount ?? 0,
      icon: Users,
      color: "text-startup",
      bg: "bg-startup/10",
    },
    {
      label: "Certificates",
      value: stats?.certificateCount ?? 0,
      icon: Award,
      color: "text-researcher",
      bg: "bg-researcher/10",
    },
  ];

  return (
    <>
      <Greeting 
        domain={user.lane as Domain} 
        title={`Welcome back, ${user.name}.`} 
        sub="Here's an overview of your learning journey."
      />

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-5">
        {quickStats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 rounded-xl border border-border bg-surface-elevated p-5 transition-shadow hover:shadow-md"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <div className="font-display text-2xl">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Recent Activity */}
        <Card title="Recent Activity" hint="Your latest actions" className="md:col-span-2">
          {(!recentActivity || recentActivity.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
              <div className="text-sm text-muted-foreground">No recent activity yet.</div>
              <div className="mt-1 text-xs text-muted-foreground/70">Enroll in courses or book mentors to see activity here.</div>
            </div>
          ) : (
            <div className="relative space-y-0">
              {recentActivity.map((item, i) => (
                <div key={i} className="relative flex items-start gap-4 py-3">
                  {/* Timeline line */}
                  {i < recentActivity.length - 1 && (
                    <div className="absolute left-[17px] top-[40px] bottom-0 w-px bg-border" />
                  )}
                  {/* Icon */}
                  <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-border ${
                    item.icon === "course" ? "bg-student/10" : "bg-startup/10"
                  }`}>
                    {item.icon === "course" ? (
                      <BookOpen className="h-3.5 w-3.5 text-student" />
                    ) : (
                      <Users className="h-3.5 w-3.5 text-startup" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.time}</div>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-1" />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Platform Overview */}
        <Card title="Platform Overview">
          <div className="space-y-4">
            <PlatformStat label="Total Courses" table="courses" />
            <PlatformStat label="Total Mentors" table="mentors" />
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Keep learning!</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground/70 leading-relaxed">
                Explore courses and book mentors to accelerate your growth journey.
              </div>
            </div>
          </div>
        </Card>

        <Card title="Available Courses" className="md:col-span-3">
          <DashboardCourses />
        </Card>

        <Card title="Expert Mentors" className="md:col-span-3">
          <DashboardMentors />
        </Card>
      </div>
    </>
  );
}

/** Small helper component to show total count from a Supabase table */
function PlatformStat({ label, table }: { label: string; table: string }) {
  const { data: count } = useQuery({
    queryKey: ["platform-count", table],
    queryFn: async () => {
      const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
  });

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-display text-xl">{count ?? "—"}</span>
    </div>
  );
}

function DashboardCourses() {
  const { data: coursesData, isLoading } = useQuery({
    queryKey: ["dashboard-courses"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      const { data, error } = await supabase.from("courses").select("*").limit(5);
      if (error) throw error;

      let enrolledIds: string[] = [];
      if (userEmail) {
        const { data: enrollments, error: enrollError } = await supabase
          .from("enrollments_users")
          .select("course_id")
          .eq("student_email", userEmail);
          
        if (enrollments && !enrollError) {
          enrolledIds = enrollments.map(e => String(e.course_id));
        }
      }

      return { courses: data || [], enrolledIds };
    }
  });

  const courses = coursesData?.courses || [];
  const enrolledIds = coursesData?.enrolledIds || [];

  if (isLoading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Loading courses...</div>;
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground mb-4 opacity-50" />
        <div className="text-sm text-muted-foreground">No courses available right now.</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {courses.map(course => (
        <div key={course.id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-5 hover:border-foreground/20 transition-colors">
          <div>
            <div className="inline-flex rounded bg-surface px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {course.category}
            </div>
            <h3 className="mt-4 font-display text-lg">{course.title}</h3>
            <div className="mt-1 text-xs text-muted-foreground">
              {course.duration ? course.duration : "Self-paced"}
            </div>
          </div>
          <div className="mt-6 border-t border-border pt-4">
            {enrolledIds.includes(String(course.id)) ? (
              <div className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground cursor-default">
                <BookOpen className="h-3 w-3" /> Enrolled
              </div>
            ) : (
              <Link
                to="/dashboard/enroll/$courseId"
                params={{ courseId: String(course.id) }}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-xs text-background hover:opacity-90 transition"
              >
                <Play className="h-3 w-3" /> Start learning
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardMentors() {
  const { data: mentorsData, isLoading } = useQuery({
    queryKey: ["dashboard-mentors"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      const { data, error } = await supabase.from("mentors").select("*").limit(3);
      if (error) throw error;

      let bookedIds: string[] = [];
      if (userEmail) {
        const { data: bookings, error: bookingError } = await supabase
          .from("mentor_bookings")
          .select("mentor_id")
          .eq("student_email", userEmail);
          
        if (bookings && !bookingError) {
          bookedIds = bookings.map(b => String(b.mentor_id));
        }
      }

      return { mentors: data || [], bookedIds };
    }
  });

  const mentors = mentorsData?.mentors || [];
  const bookedIds = mentorsData?.bookedIds || [];

  const domain = "student" as Domain;
  const d = DOMAINS[domain];

  if (isLoading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Loading mentors...</div>;
  }

  if (mentors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Users className="h-8 w-8 text-muted-foreground mb-4 opacity-50" />
        <div className="text-sm text-muted-foreground">No mentors available right now.</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {mentors.map(m => (
        <div key={m.id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-5 hover:border-foreground/20 transition-colors">
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-full ${d.softBgClass} grid place-items-center font-display text-xl shrink-0 ${d.accentClass}`}>
              {m.name[0]}
            </div>
            <div>
              <h3 className="font-display text-lg leading-tight">{m.name}</h3>
              <div className="text-sm text-muted-foreground mt-0.5">{m.experience}</div>
            </div>
          </div>
          
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <div className="font-mono text-sm">Free</div>
            {bookedIds.includes(String(m.id)) ? (
              <div className="inline-flex items-center gap-2 rounded-md bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground cursor-default">
                Enrolled
              </div>
            ) : (
              <Link
                to="/dashboard/book/$mentorId"
                params={{ mentorId: String(m.id) }}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-1.5 text-xs text-background hover:opacity-90 transition"
              >
                <Calendar className="h-3 w-3" /> Book session
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
