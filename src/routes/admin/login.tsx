import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Shield } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute rounded-full"
          style={{
            left: "15%",
            top: "25%",
            width: 320,
            height: 320,
            background: "radial-gradient(circle, var(--student) 0%, transparent 70%)",
            opacity: 0.07,
            filter: "blur(60px)",
          }}
          animate={{ x: [-20, 20, -20], y: [-15, 15, -15] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, oklch(0.2 0.015 260) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <header className="fixed top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Wordmark />
          <Link
            to="/"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Back to site
          </Link>
        </div>
      </header>

      <div className="flex min-h-screen items-center justify-center px-6 pt-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-border bg-surface-elevated">
              <Shield className="h-5 w-5 text-student" />
            </div>
            <h1 className="font-display text-3xl">Admin sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Access the Micrylis admin control panel
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-surface-elevated p-6 md:p-8"
          >
            {error && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@admin.com"
                  className="border-border bg-background"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="border-border bg-background pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-6 w-full bg-foreground text-background hover:bg-foreground/90"
            >
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Frontend-only authentication for testing purposes.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
