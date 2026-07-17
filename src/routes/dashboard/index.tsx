import { createFileRoute } from "@tanstack/react-router";
import { Play, Calendar } from "lucide-react";
import { mockUser, type User } from "@/lib/mockUser";
import { type Domain } from "@/lib/domain";
import { Card, Greeting, MentorRow, GuidanceRow } from "@/components/dashboard-shared";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/utils/supabase";
import { DOMAINS } from "@/lib/domain";

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

  const user = { 
    ...mockUser, 
    name: profile?.name || mockUser.name,
    lane: "student" as Domain 
  };

  return (
    <>
      <Greeting 
        domain={user.lane as Domain} 
        title={`Welcome back, ${user.name}.`} 
        sub={`You're ${user.activeTrack.progress}% through your ${user.activeTrack.name} track.`} 
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Your learning path" className="md:col-span-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-3xl">{user.activeTrack.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Module {user.activeTrack.currentModule} of {user.activeTrack.totalModules} — {user.activeTrack.moduleName}
              </div>
            </div>
            <div className={`font-mono text-3xl text-${user.lane}`}>{user.activeTrack.progress}%</div>
          </div>
          <div className="mt-6 h-1.5 w-full rounded-full bg-border">
            <div className={`h-full rounded-full bg-${user.lane}`} style={{ width: `${user.activeTrack.progress}%` }} />
          </div>
          <div className="mt-6 grid grid-cols-7 gap-1.5">
            {[1, 1, 1, 1, 0.5, 0, 0].map((v, i) => (
              <div key={i} className="rounded" style={{ height: 40, background: `color-mix(in oklab, var(--${user.lane}) ${v * 100}%, transparent)` }} />
            ))}
          </div>
          <button className="mt-6 inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-sm text-background">
            <Play className="h-3.5 w-3.5" /> Continue lesson
          </button>
        </Card>

        <Card title="Skill radar" hint="Self vs assessment">
          <div className="space-y-3">
            {[
              ["Visual", user.skillRadar.visual, 70], 
              ["Interaction", user.skillRadar.interaction, 60], 
              ["Research", user.skillRadar.research, 50], 
              ["Prototyping", user.skillRadar.prototyping, 55]
            ].map(([label, self, real]) => (
              <div key={label as string}>
                <div className="flex items-center justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-mono text-muted-foreground">{self}/{real}</span>
                </div>
                <div className="mt-1 flex h-1.5 gap-1">
                  <div className={`h-full rounded bg-${user.lane}/40`} style={{ width: `${self as number}%` }} />
                  <div className={`h-full rounded bg-${user.lane}`} style={{ width: `${(real as number) - (self as number)}%` }} />
                </div>
              </div>
            ))}
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

import { Link } from "@tanstack/react-router";
import { BookOpen, Users } from "lucide-react";

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
