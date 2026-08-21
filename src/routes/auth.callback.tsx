import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { motion } from "framer-motion";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function handleAuthCallback() {
      // 1. Check if token_hash and type exist in URL search parameters (from direct email link)
      const searchParams = new URLSearchParams(window.location.search);
      const tokenHash = searchParams.get("token_hash");
      const typeParam = searchParams.get("type");
      const redirectToParam = searchParams.get("redirect_to");

      if (tokenHash && typeParam) {
        const otpType = (
          typeParam === "signup"
            ? "signup"
            : typeParam === "recovery"
            ? "recovery"
            : typeParam === "email_change"
            ? "email_change"
            : "email"
        );

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType as any,
        });

        if (error) {
          console.error("Callback token_hash verification error:", error);
          setErrorMsg(error.message || "Failed to verify email link.");
          setStatus("error");
          return;
        }

        if (data.session) {
          if (typeParam === "recovery") {
            navigate({ to: "/reset-password", replace: true });
          } else {
            const dest = redirectToParam ? decodeURIComponent(redirectToParam) : "/dashboard";
            navigate({ to: dest as any, replace: true });
          }
          return;
        }
      }

      // 2. Also check hash-based OAuth / magic link tokens (#access_token=...)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === "SIGNED_IN" && session) {
            navigate({ to: "/dashboard", replace: true });
          } else if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
            setErrorMsg("Authentication failed. Please try signing in again.");
            setStatus("error");
          }
        }
      );

      // Check existing session
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        setErrorMsg(error.message);
        setStatus("error");
        return;
      }
      if (session) {
        navigate({ to: "/dashboard", replace: true });
      }

      return () => {
        subscription.unsubscribe();
      };
    }

    handleAuthCallback();

    // Fallback: if after 10 seconds nothing happened, show an error
    const timeout = setTimeout(() => {
      setErrorMsg("Authentication timed out. Please try again.");
      setStatus("error");
    }, 10000);

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background text-foreground overflow-hidden">
      {/* Subtle background orb */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, oklch(0.55 0.15 255 / 0.06) 0%, transparent 100%)",
        }}
      />

      {status === "loading" ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6"
        >
          {/* Spinner */}
          <motion.div
            className="h-12 w-12 rounded-full border-[3px] border-border border-t-foreground"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
          <div className="text-center space-y-1">
            <p className="text-base font-medium">Finishing sign-in…</p>
            <p className="text-sm text-muted-foreground">
              Hang tight, setting up your session.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-center max-w-sm px-6"
        >
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive text-2xl">
            ✕
          </div>
          <div>
            <p className="font-medium text-destructive">Authentication Error</p>
            <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
          </div>
          <a
            href="/login"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 transition"
          >
            Back to Sign In
          </a>
        </motion.div>
      )}
    </div>
  );
}
