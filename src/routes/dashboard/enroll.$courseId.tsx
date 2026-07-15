import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";

export const Route = createFileRoute("/dashboard/enroll/$courseId")({
  component: CourseEnrollmentPage,
});

type SubmitState = "idle" | "loading" | "success" | "error";

function CourseEnrollmentPage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone_no: "",
  });
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitState("loading");
    setErrorMsg("");

    try {
      // Step 1: Check if the user already exists by email
      const { data: existingUser, error: lookupError } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", formData.email)
        .maybeSingle();

      if (lookupError) throw lookupError;

      let userId: number;

      if (existingUser) {
        // User already exists — reuse their id
        userId = existingUser.user_id;
      } else {
        // Step 2a: Create a new user
        const { data: newUser, error: userError } = await supabase
          .from("users")
          .insert({
            name: formData.name,
            email: formData.email,
            phone_no: formData.phone_no || null,
          })
          .select("user_id")
          .single();

        console.log(newUser)

        if (userError) throw userError;
        userId = newUser.user_id;
      }

      // Step 3: Create enrollment (upsert guards against duplicate enrollments)
      const { error: enrollError } = await supabase
        .from("enrollments")
        .insert({
          user_id: userId,
          course_id: Number(courseId),
          status: "Active",
        });

      // Ignore unique-constraint violation (user already enrolled)
      if (enrollError && enrollError.code !== "23505") throw enrollError;

      setSubmitState("success");

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate({ to: "/dashboard/courses" });
      }, 2000);
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
      setSubmitState("error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <Link
          to="/dashboard/courses"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to courses
        </Link>
        <h1 className="font-display text-4xl mt-2">
          {courseLoading
            ? "Loading..."
            : `Enroll in ${course?.course_name || course?.title || "Course"}`}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Fill in your details below to get started
          {course?.course_duration ? ` with this ${course.course_duration} course.` : "."}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-8">
        {submitState === "success" ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="font-display text-2xl">Enrollment Successful!</h2>
            <p className="text-muted-foreground">
              Welcome aboard 🎉 Redirecting you back to courses…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                disabled={submitState === "loading"}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={submitState === "loading"}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_no">Phone Number</Label>
              <Input
                id="phone_no"
                name="phone_no"
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.phone_no}
                onChange={handleChange}
                disabled={submitState === "loading"}
              />
            </div>

            {submitState === "error" && (
              <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <Button
                type="submit"
                className="w-full"
                disabled={submitState === "loading"}
              >
                {submitState === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enrolling…
                  </>
                ) : (
                  "Submit & Start Learning"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
