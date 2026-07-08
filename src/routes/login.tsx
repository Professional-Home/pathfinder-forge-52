import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, EyeOff, GraduationCap, Rocket, Microscope, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { supabase } from "@/utils/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — MentorForge" },
      { name: "description", content: "Sign in to your MentorForge account and continue your growth journey." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

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

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/onboarding`,
      }
    })
    if (error) {
      setError(error.message);
    } else {
      setTimeout(() => {
        setGoogleLoading(false);
        navigate({ to: "/onboarding" });
      }, 2000);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    }

    setError("");
    setLoading(false);
    // Simulate auth — replace with real Supabase auth
    setTimeout(() => {
      const profile = localStorage.getItem("mf_profile");
      if (profile) {
        const { domain } = JSON.parse(profile);
        navigate({ to: "/dashboard/$domain", params: { domain: domain || "student" } });
      } else {
        navigate({ to: "/onboarding" });
      }
    }, 1600);
  }

  const orbs = [
    { color: "var(--student)", x: "10%", y: "20%", size: 320, delay: 0 },
    { color: "var(--startup)", x: "75%", y: "60%", size: 260, delay: 1.5 },
    { color: "var(--researcher)", x: "50%", y: "85%", size: 200, delay: 3 },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Animated background orbs */}
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
              opacity: 0.07,
              filter: "blur(60px)",
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              x: [-20, 20, -20],
              y: [-15, 15, -15],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 12 + i * 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: orb.delay,
            }}
          />
        ))}
        {/* Grid texture */}
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
            <span className="text-muted-foreground">Don't have an account?</span>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90"
            >
              Sign up <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Main layout: split */}
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left panel — branding */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="hidden flex-col justify-between bg-surface border-r border-border/60 px-14 py-28 lg:flex"
        >
          <div className="mt-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs text-muted-foreground"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="h-3 w-3" />
              </motion.div>
              15 questions. One personalized path.
            </motion.div>

            <h2 className="font-display text-5xl leading-tight md:text-6xl">
              Welcome<br />
              <span className="italic text-muted-foreground">back.</span>
            </h2>
            <p className="mt-6 max-w-xs text-muted-foreground leading-relaxed">
              Your growth path, mentors, and certifications are waiting. Sign in to continue where you left off.
            </p>
          </div>

          {/* Domain lane badges */}
          <div className="space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
              Three lanes, one platform
            </div>
            {[
              { Icon: GraduationCap, label: "Student", desc: "Skill-building & career paths", color: "text-student", bg: "bg-student/10" },
              { Icon: Rocket, label: "Startup", desc: "Founder-focused mentorship", color: "text-startup", bg: "bg-startup/10" },
              { Icon: Microscope, label: "Researcher", desc: "Expert review & methodology", color: "text-researcher", bg: "bg-researcher/10" },
            ].map(({ Icon, label, desc, color, bg }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.12, duration: 0.6 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right panel — form */}
        <div className="flex items-center justify-center px-6 py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="w-full max-w-sm"
          >
            {/* Mobile logo */}
            <div className="mb-8 lg:hidden">
              <Wordmark />
            </div>

            <div className="mb-8">
              <h1 className="font-display text-4xl">Sign in</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Continue your personalized growth journey.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Email
                </label>
                <motion.div
                  animate={{ borderColor: focusedField === "email" ? "oklch(0.18 0.015 260)" : "oklch(0.9 0.008 85)" }}
                  className="relative overflow-hidden rounded-xl border bg-surface-elevated transition-shadow"
                  style={{ boxShadow: focusedField === "email" ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)" : "none" }}
                >
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                </motion.div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Password
                </label>
                <motion.div
                  animate={{ borderColor: focusedField === "password" ? "oklch(0.18 0.015 260)" : "oklch(0.9 0.008 85)" }}
                  className="relative overflow-hidden rounded-xl border bg-surface-elevated transition-shadow"
                  style={{ boxShadow: focusedField === "password" ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)" : "none" }}
                >
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    autoComplete="current-password"
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
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Error message */}
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

              {/* Submit */}
              <motion.button
                type="submit"
                id="login-submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="relative w-full overflow-hidden rounded-xl bg-foreground px-5 py-3.5 text-sm font-medium text-background transition disabled:opacity-60"
              >
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <motion.span
                        className="inline-block h-4 w-4 rounded-full border-2 border-background/30 border-t-background"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      Signing in…
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-2"
                    >
                      Continue <ArrowRight className="h-3.5 w-3.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Google sign-in */}
              <motion.button
                type="button"
                id="login-google"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
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
                      Continue with Google
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Divider */}
              <div className="relative flex items-center gap-3 py-1">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">or sign in with email</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Sign up link */}
              <p className="text-center text-sm text-muted-foreground">
                New to MentorForge?{" "}
                <Link
                  to="/signup"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Create an account
                </Link>
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
