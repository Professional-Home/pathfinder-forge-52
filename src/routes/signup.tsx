import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, EyeOff, GraduationCap, Rocket, Microscope, Sparkles, Check } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { supabase } from "@/utils/supabase";
import { setCookie } from "@/lib/cookies";

/** Official Google "G" logo in SVG */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Micrylis" },
      { name: "description", content: "Create your free Micrylis account and start building your personalized growth path." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignupPage,
});

type DomainPick = "student" | "startup" | "researcher" | null;

function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "domain">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [college, setCollege] = useState("");
  const [degree, setDegree] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [domainPick, setDomainPick] = useState<DomainPick>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    // Handle error hashes
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get("error");
      const errorDescription = hashParams.get("error_description");
      if (hashError || errorDescription) {
        setError(errorDescription?.replace(/\+/g, " ") || hashError || "Authentication failed");
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    // Listen for Google Login success
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate({ to: "/dashboard" });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      }
    });

    console.log("google sign in")

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // No else block needed because Supabase will navigate the browser away to Google.
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          mobile,
          college,
          degree,
        }
      }
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      // Save user to public users table
      if (data.user) {
        await supabase.from("users").upsert({
          id: data.user.id,
          name,
          email,
          phone_no: mobile || null,
        });

        // Save other details to profile table
        await supabase.from("profile").upsert({
          id: data.user.id,
          email,
          name,
          mobile,
          college,
          degree
        });
      }

      setStep("domain");
    }
  }



  function handleFinish() {
    if (!domainPick) return;
    setLoading(true);
    // Simulate account creation — replace with Supabase auth
    setTimeout(() => {
      try {
        setCookie("mf_profile", JSON.stringify({ name, domain: domainPick, created_at: Date.now() }));
      } catch { }
      navigate({ to: "/onboarding" });
    }, 1800);
  }

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ["", "bg-destructive", "bg-startup", "bg-researcher"];
  const strengthLabels = ["", "Too short", "Getting there", "Strong"];

  const lanes = [
    {
      id: "student" as const,
      Icon: GraduationCap,
      label: "Student",
      hint: "Learning a skill or picking a career path",
      color: "text-student",
      bg: "bg-student/10",
      border: "border-student/40",
      ring: "ring-student/20",
    },
    {
      id: "startup" as const,
      Icon: Rocket,
      label: "Startup",
      hint: "Founder or early team member building something",
      color: "text-startup",
      bg: "bg-startup/10",
      border: "border-startup/40",
      ring: "ring-startup/20",
    },
    {
      id: "researcher" as const,
      Icon: Microscope,
      label: "Researcher",
      hint: "Academic, independent researcher, or scientist",
      color: "text-researcher",
      bg: "bg-researcher/10",
      border: "border-researcher/40",
      ring: "ring-researcher/20",
    },
  ];

  const orbs = [
    { color: "var(--student)", x: "85%", y: "15%", size: 300, delay: 0 },
    { color: "var(--startup)", x: "10%", y: "70%", size: 250, delay: 2 },
    { color: "var(--researcher)", x: "55%", y: "90%", size: 200, delay: 4 },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {orbs.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: orb.x,
              top: orb.y,
              width: orb.size,
              height: orb.size,
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
              opacity: 0.08,
              filter: "blur(60px)",
              transform: "translate(-50%, -50%)",
            }}
            animate={{ x: [-15, 15, -15], y: [-12, 12, -12], scale: [1, 1.08, 1] }}
            transition={{ duration: 14 + i * 4, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
          />
        ))}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, oklch(0.2 0.015 260) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Wordmark />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Already have an account?</span>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-border-strong"
            >
              Sign in
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Stepper indicator */}
      <div className="fixed top-14 left-0 right-0 z-30">
        <div className="h-0.5 w-full bg-border">
          <motion.div
            className="h-full bg-foreground"
            animate={{ width: step === "form" ? "50%" : "100%" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      <div className="flex min-h-screen items-center justify-center px-6 pt-28 pb-16">
        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.div
              key="form-step"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-muted-foreground"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="h-3 w-3" />
                </motion.div>
                Step 1 of 2 — Account details
              </motion.div>

              <h1 className="font-display text-4xl">
                Create your<br />
                <span className="italic text-muted-foreground">free account.</span>
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Get your personalized path in 5 minutes — no credit card needed.
              </p>

              <form onSubmit={handleFormSubmit} className="mt-8 space-y-4" id="signup-form">
                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-name" className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Full Name *
                  </label>
                  <motion.div
                    className="overflow-hidden rounded-xl border bg-surface-elevated"
                    style={{ boxShadow: focusedField === "name" ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)" : "none" }}
                  >
                    <input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Alex Doe"
                      autoComplete="name"
                      required
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </motion.div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-email" className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Email Address *
                  </label>
                  <motion.div
                    className="overflow-hidden rounded-xl border bg-surface-elevated"
                    style={{ boxShadow: focusedField === "email" ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)" : "none" }}
                  >
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </motion.div>
                </div>

                {/* Mobile */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-mobile" className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Mobile Number (WhatsApp) *
                  </label>
                  <motion.div
                    className="overflow-hidden rounded-xl border bg-surface-elevated"
                    style={{ boxShadow: focusedField === "mobile" ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)" : "none" }}
                  >
                    <input
                      id="signup-mobile"
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      onFocus={() => setFocusedField("mobile")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="+1 234 567 8900"
                      autoComplete="tel"
                      required
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </motion.div>
                </div>

                {/* College */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-college" className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    College/University Name *
                  </label>
                  <motion.div
                    className="overflow-hidden rounded-xl border bg-surface-elevated"
                    style={{ boxShadow: focusedField === "college" ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)" : "none" }}
                  >
                    <input
                      id="signup-college"
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      onFocus={() => setFocusedField("college")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Harvard University"
                      required
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </motion.div>
                </div>

                {/* Degree */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-degree" className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Degree
                  </label>
                  <motion.div
                    className="overflow-hidden rounded-xl border bg-surface-elevated"
                    style={{ boxShadow: focusedField === "degree" ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)" : "none" }}
                  >
                    <input
                      id="signup-degree"
                      type="text"
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      onFocus={() => setFocusedField("degree")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="B.Sc. Computer Science"
                      className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </motion.div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-password" className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Password *
                  </label>
                  <motion.div
                    className="relative overflow-hidden rounded-xl border bg-surface-elevated"
                    style={{ boxShadow: focusedField === "password" ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)" : "none" }}
                  >
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      required
                      className="w-full bg-transparent px-4 py-3.5 pr-12 text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </motion.div>
                  {/* Strength meter */}
                  {password.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-1"
                    >
                      <div className="flex gap-1">
                        {[1, 2, 3].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${passwordStrength >= level ? strengthColors[passwordStrength] : "bg-border"
                              }`}
                          />
                        ))}
                      </div>
                      <div className={`text-xs ${passwordStrength === 1 ? "text-destructive" : passwordStrength === 2 ? "text-startup" : "text-researcher"}`}>
                        {strengthLabels[passwordStrength]}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -6, height: 0 }}
                      className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  id="signup-submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3.5 text-sm font-medium text-background transition hover:opacity-90"
                >
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </motion.button>

                {/* Google sign-up */}
                <motion.button
                  type="button"
                  id="signup-google"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 20px -4px rgba(0,0,0,0.12)" }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface-elevated px-5 py-3.5 text-sm font-medium text-foreground transition hover:border-border-strong disabled:opacity-60"
                >
                  <AnimatePresence mode="wait">
                    {googleLoading ? (
                      <motion.span
                        key="g-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <motion.span
                          className="inline-block h-4 w-4 rounded-full border-2 border-border-strong border-t-foreground"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        />
                        Connecting…
                      </motion.span>
                    ) : (
                      <motion.span
                        key="g-idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3"
                      >
                        <GoogleIcon />
                        Sign up with Google
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                <div className="relative flex items-center gap-3 py-1">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-xs text-muted-foreground">or sign up with email</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                    Sign in
                  </Link>
                </p>

                <p className="text-center text-xs text-muted-foreground">
                  By continuing you agree to our{" "}
                  <span className="underline underline-offset-2 cursor-pointer hover:text-foreground">Terms</span>
                  {" "}and{" "}
                  <span className="underline underline-offset-2 cursor-pointer hover:text-foreground">Privacy Policy</span>.
                </p>
              </form>
            </motion.div>

          ) : (
            <motion.div
              key="domain-step"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-muted-foreground"
              >
                <Sparkles className="h-3 w-3" />
                Step 2 of 2 — Pick your lane
              </motion.div>

              <h1 className="font-display text-4xl">
                Hi {name || "there"},{" "}
                <span className="italic text-muted-foreground">which lane fits?</span>
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                This sets your mentors, courses, and dashboard layout. You can change it anytime.
              </p>

              <div className="mt-8 grid gap-3" id="domain-selection">
                {lanes.map(({ id, Icon, label, hint, color, bg, border, ring }, i) => {
                  const active = domainPick === id;
                  return (
                    <motion.button
                      key={id}
                      id={`domain-${id}`}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.1, duration: 0.5 }}
                      onClick={() => setDomainPick(id)}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      className={`group flex w-full items-center justify-between rounded-2xl border p-5 text-left transition-all ${active
                        ? `${border} bg-surface-elevated ring-2 ${ring}`
                        : "border-border bg-surface-elevated hover:border-border-strong"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <motion.div
                          animate={{ scale: active ? 1.1 : 1 }}
                          className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg}`}
                        >
                          <Icon className={`h-5 w-5 ${color}`} />
                        </motion.div>
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className={`mt-0.5 text-xs ${active ? "text-muted-foreground" : "text-muted-foreground"}`}>
                            {hint}
                          </div>
                        </div>
                      </div>
                      <motion.div
                        animate={{
                          scale: active ? 1 : 0.8,
                          opacity: active ? 1 : 0.3,
                        }}
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${active ? bg : "bg-border"}`}
                      >
                        <Check className={`h-3.5 w-3.5 ${active ? color : "text-muted-foreground"}`} />
                      </motion.div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center gap-3">
                <motion.button
                  type="button"
                  onClick={() => setStep("form")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-none rounded-xl border border-border bg-surface-elevated px-5 py-3.5 text-sm font-medium text-foreground transition hover:border-border-strong"
                >
                  Back
                </motion.button>
                <motion.button
                  type="button"
                  id="signup-finish"
                  onClick={handleFinish}
                  disabled={!domainPick || loading}
                  whileHover={{ scale: domainPick && !loading ? 1.02 : 1 }}
                  whileTap={{ scale: domainPick && !loading ? 0.98 : 1 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3.5 text-sm font-medium text-background transition disabled:opacity-40"
                >
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <motion.span
                          className="inline-block h-4 w-4 rounded-full border-2 border-background/30 border-t-background"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        />
                        Creating your path…
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        Start the quiz <ArrowRight className="h-3.5 w-3.5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                You'll answer 15 quick questions to customize your dashboard.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
