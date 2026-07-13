import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Shield,
  BookOpen,
  Users,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { adminLogin, isAdminLoggedIn } from "@/lib/adminAuth";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login — Micrylis" },
      { name: "description", content: "Sign in to the Micrylis admin panel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (isAdminLoggedIn()) {
      navigate({ to: "/admin/dashboard" });
    }
  }, [navigate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");

    setTimeout(() => {
      const success = adminLogin(email, password);
      if (success) {
        navigate({ to: "/admin/dashboard" });
      } else {
        setError("Invalid credentials. Access denied.");
      }
      setLoading(false);
    }, 600);
  }

  const orbs = [
    { color: "var(--student)", x: "10%", y: "20%", size: 320, delay: 0 },
    { color: "var(--startup)", x: "75%", y: "60%", size: 260, delay: 1.5 },
    { color: "var(--researcher)", x: "50%", y: "85%", size: 200, delay: 3 },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
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
            animate={{ x: [-20, 20, -20], y: [-15, 15, -15] }}
            transition={{
              duration: 12 + i * 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: orb.delay,
            }}
          />
        ))}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, oklch(0.2 0.015 260) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Wordmark />
          <Link
            to="/"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Back to site
          </Link>
        </div>
      </motion.header>

      <div className="grid min-h-screen lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="hidden flex-col justify-between border-r border-border/60 bg-surface px-14 py-28 lg:flex"
        >
          <div className="mt-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs text-muted-foreground"
            >
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <Sparkles className="h-3 w-3" />
              </motion.div>
              Secure admin access
            </motion.div>

            <h2 className="font-display text-5xl leading-tight md:text-6xl">
              Admin<br />
              <span className="italic text-muted-foreground">control.</span>
            </h2>
            <p className="mt-6 max-w-xs leading-relaxed text-muted-foreground">
              Manage courses, mentors, enrollments, and guidance sessions from one place.
            </p>
          </div>

          <div className="space-y-3">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              What you can manage
            </div>
            {[
              { Icon: BookOpen, label: "Courses", desc: "Create, publish, and edit", color: "text-student", bg: "bg-student/10" },
              { Icon: Users, label: "Mentors", desc: "Assign experts to courses", color: "text-startup", bg: "bg-startup/10" },
              { Icon: Calendar, label: "Guidance", desc: "Schedule student sessions", color: "text-researcher", bg: "bg-researcher/10" },
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

        <div className="flex items-center justify-center px-4 py-20 sm:px-6 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="w-full max-w-sm"
          >
            <div className="mb-8 lg:hidden">
              <Wordmark />
            </div>

            <div className="mb-8">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-elevated">
                <Shield className="h-5 w-5 text-student" />
              </div>
              <h1 className="font-display text-3xl sm:text-4xl">Admin sign in</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Access the Micrylis control panel.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-email"
                  className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
                >
                  Email
                </label>
                <motion.div
                  animate={{
                    borderColor:
                      focusedField === "email" ? "oklch(0.18 0.015 260)" : "oklch(0.9 0.008 85)",
                  }}
                  className="relative overflow-hidden rounded-xl border bg-surface-elevated transition-shadow"
                  style={{
                    boxShadow:
                      focusedField === "email"
                        ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)"
                        : "none",
                  }}
                >
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="admin@admin.com"
                    autoComplete="username"
                    className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                </motion.div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password"
                  className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
                >
                  Password
                </label>
                <motion.div
                  animate={{
                    borderColor:
                      focusedField === "password"
                        ? "oklch(0.18 0.015 260)"
                        : "oklch(0.9 0.008 85)",
                  }}
                  className="relative overflow-hidden rounded-xl border bg-surface-elevated transition-shadow"
                  style={{
                    boxShadow:
                      focusedField === "password"
                        ? "0 0 0 3px oklch(0.55 0.15 255 / 0.1)"
                        : "none",
                  }}
                >
                  <input
                    id="admin-password"
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
              </div>

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

              <p className="text-center text-xs text-muted-foreground">
                Frontend-only auth for testing. Backend integration pending.
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
