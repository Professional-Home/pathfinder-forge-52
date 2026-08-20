import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, Lock } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { supabase } from "@/utils/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — Micrylis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Verify user session or error hash
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get("error_description");
      if (hashError) {
        setError(hashError.replace(/\+/g, " "));
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!password || password.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateErr } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateErr) {
      setError(updateErr.message || "Failed to update password. Link may have expired.");
    } else {
      setSuccess(true);
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 3000);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 py-12">
      <div className="mb-8">
        <Wordmark />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-8 shadow-xl"
      >
        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold">Password updated</h1>
            <p className="text-sm text-muted-foreground">
              Your password has been successfully updated. Redirecting you to sign in...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface border border-border">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <h1 className="font-display text-2xl font-semibold">Set new password</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Please enter a new password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  New Password
                </label>
                <div className="relative overflow-hidden rounded-xl border border-border bg-background">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Confirm Password
                </label>
                <div className="relative overflow-hidden rounded-xl border border-border bg-background">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
