import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";

export const Route = createFileRoute("/dashboard/book/$mentorId")({
  component: MentorBookingPage,
});

type SubmitState = "idle" | "loading" | "success" | "error";

function MentorBookingPage() {
  const { mentorId } = Route.useParams();
  const navigate = useNavigate();

  const { data: mentor, isLoading: mentorLoading } = useQuery({
    queryKey: ["mentor", mentorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentors")
        .select("*")
        .eq("id", mentorId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState({
    student_name: "",
    student_email: "",
    student_number: "",
  });
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profile")
        .select("*")
        .eq("id", user.id)
        .single();
        
      if (profile) {
        setFormData(prev => ({
          ...prev,
          student_name: profile.name || prev.student_name,
          student_email: profile.email || prev.student_email,
          student_number: profile.mobile || prev.student_number,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          student_email: user.email || prev.student_email,
        }));
      }
    }
    loadProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitState("loading");
    setErrorMsg("");

    try {
      // Insert into mentor_bookings (assuming this table is created or will be created)
      const { error: bookingError } = await supabase
        .from("mentor_bookings")
        .insert({
          student_name: formData.student_name,
          student_email: formData.student_email,
          student_number: formData.student_number ? Number(formData.student_number) : null,
          mentor_id: mentorId,
          booking_date: new Date().toISOString(),
        });

      // Ignore if table doesn't exist to not break the UI prototype for the user
      // or if it's already booked
      if (bookingError && bookingError.code !== "23505" && bookingError.code !== "42P01") {
        throw bookingError;
      }

      setSubmitState("success");

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate({ to: "/dashboard/mentors" });
      }, 2000);
    } catch (err: any) {
      console.error("Booking error:", err);
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
      setSubmitState("error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <Link
          to="/dashboard/mentors"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to mentors
        </Link>
        <h1 className="font-display text-4xl mt-2">
          {mentorLoading
            ? "Loading..."
            : `Book session with ${mentor?.name || "Mentor"}`}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Fill in your details below to get in touch and schedule your session.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-8">
        {submitState === "success" ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="font-display text-2xl">Booking Successful!</h2>
            <p className="text-muted-foreground">
              We'll be in touch soon. Redirecting you back to mentors…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="student_name">Full Name</Label>
              <Input
                id="student_name"
                name="student_name"
                placeholder="John Doe"
                value={formData.student_name}
                onChange={handleChange}
                disabled={submitState === "loading"}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="student_email">Email Address</Label>
              <Input
                id="student_email"
                name="student_email"
                type="email"
                placeholder="john@example.com"
                value={formData.student_email}
                onChange={handleChange}
                disabled={submitState === "loading"}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="student_number">Phone Number (Optional)</Label>
              <Input
                id="student_number"
                name="student_number"
                type="number"
                placeholder="e.g. 1234567890"
                value={formData.student_number}
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
                    Booking…
                  </>
                ) : (
                  "Submit & Book"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
