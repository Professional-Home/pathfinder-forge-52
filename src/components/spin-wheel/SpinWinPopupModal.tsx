import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Gift,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Clock,
  Phone,
  School,
  Mail,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SpinWheelCanvas } from "./SpinWheelCanvas";
import {
  SPIN_REWARDS,
  isSpinOfferExpired,
  SPIN_EXPIRY_LABEL,
} from "@/lib/spin-wheel/config";
import type { SpinReward, SpinWheelEntry } from "@/lib/spin-wheel/types";
import { fireConfetti } from "@/lib/spin-wheel/confetti";
import {
  checkEmailSpun,
  executeSpinRoll,
  claimSpinReward,
  rejectSpinReward,
  acceptSpinReward,
} from "@/lib/spin-wheel-server";
import { formatAuthErrorMessage } from "@/lib/spin-wheel/auth-error";
import { supabase } from "@/utils/supabase";

const SESSION_DISMISSED_KEY = "micrylis_spin_modal_dismissed";
const SESSION_COMPLETED_KEY = "micrylis_spin_modal_completed";

export function SpinWinPopupModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<
    | "intro"
    | "otp"
    | "already_spun"
    | "wheel"
    | "won_modal"
    | "claim_form"
    | "claimed_success"
    | "accepted_form"
  >("intro");

  // Form State (strictly empty initial OTP)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [college, setCollege] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [formUrl, setFormUrl] = useState("");

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Wheel State
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  const [wonReward, setWonReward] = useState<SpinReward | null>(null);
  const [voucherCode, setVoucherCode] = useState<string>("");
  const [spinAuthToken, setSpinAuthToken] = useState<string>("");
  const [existingEntry, setExistingEntry] = useState<SpinWheelEntry | null>(null);

  // Auto-open once per session if not expired
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSpinOfferExpired()) return;

    const isDismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY);
    const isCompleted = sessionStorage.getItem(SESSION_COMPLETED_KEY);

    if (!isDismissed && !isCompleted) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleClose = () => {
    setIsOpen(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, "true");
    }
  };

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setErrorMsg("Please enter your name.");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      // 1. Guard against duplicate spin (without leaking participant PII)
      const checkRes = await checkEmailSpun({ data: { email: trimmedEmail } });
      if (checkRes.alreadySpun) {
        setExistingEntry({
          id: "already-spun",
          name: trimmedName,
          email: trimmedEmail,
          rewardId: "won-reward",
          rewardTitle: checkRes.rewardTitle || "Promotional Reward",
          voucherCode: "Recorded in campaign system",
          probabilityPct: 0,
          status: "won",
          isClaimed: false,
          createdAt: new Date().toISOString(),
        });
        setStep("already_spun");
        setLoading(false);
        return;
      }

      // 2. Request OTP via native Supabase Auth Email OTP
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          data: { full_name: trimmedName },
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        setErrorMsg(
          formatAuthErrorMessage(
            otpError,
            "Failed to send verification email. Please try again."
          )
        );
        return;
      }

      // Transition to OTP screen with EMPTY input (user must check inbox)
      setOtpCode("");
      setStep("otp");
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMsg(
        formatAuthErrorMessage(
          err,
          "Failed to send verification email. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP via native Supabase Auth
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedOtp = otpCode.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedOtp.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit verification code from your email.");
      return;
    }

    setLoading(true);
    try {
      const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: trimmedOtp,
        type: "email",
      });

      if (verifyErr || !verifyData?.session?.access_token) {
        setErrorMsg(
          formatAuthErrorMessage(
            verifyErr,
            "Invalid or expired verification code. Please check your inbox and try again."
          )
        );
        return;
      }

      // Confirm verified email matches entered email
      const verifiedUserEmail = verifyData.user?.email?.trim().toLowerCase();
      if (verifiedUserEmail && verifiedUserEmail !== normalizedEmail) {
        setErrorMsg("Verified email does not match entered email. Please verify again.");
        return;
      }

      setSpinAuthToken(verifyData.session.access_token);
      setStep("wheel");
    } catch (err: any) {
      setErrorMsg(
        formatAuthErrorMessage(
          err,
          "Verification failed. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP via native Supabase Auth
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setErrorMsg("");
    setLoading(true);
    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          data: { full_name: trimmedName },
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        setErrorMsg(
          formatAuthErrorMessage(
            otpError,
            "Unable to resend verification code. Please try again."
          )
        );
      } else {
        setResendCooldown(60);
      }
    } catch (err: any) {
      setErrorMsg(
        formatAuthErrorMessage(
          err,
          "Unable to resend verification code. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Trigger Server Spin (Zero-Trust Session Authenticated)
  const handleSpinClick = async () => {
    if (isSpinning || wonReward) return;

    setErrorMsg("");
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const tokenToSend = sessionData?.session?.access_token || spinAuthToken;

      const rollRes = await executeSpinRoll({
        data: {
          authToken: tokenToSend,
          name: name.trim(),
        },
      });

      if (!rollRes.success) {
        if (rollRes.code === "AUTH_REQUIRED") {
          setErrorMsg("Verification required. A verified email session is required to spin.");
          setStep("intro");
          return;
        }
        setErrorMsg(rollRes.message || "Spin failed.");
        if (rollRes.code === "ALREADY_SPUN" && rollRes.entry) {
          setExistingEntry(rollRes.entry as any);
          setStep("already_spun");
        }
        return;
      }

      if (
        typeof rollRes.winningIndex === "number" &&
        rollRes.reward &&
        rollRes.voucherCode
      ) {
        setWinningIndex(rollRes.winningIndex);
        setWonReward(rollRes.reward);
        setVoucherCode(rollRes.voucherCode);
        setIsSpinning(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Could not roll wheel.");
    } finally {
      setLoading(false);
    }
  };

  // Wheel stop callback
  const handleSpinComplete = () => {
    setIsSpinning(false);
    fireConfetti();
    setTimeout(() => {
      setStep("won_modal");
    }, 600);
  };

  // Step 4A: Accept Offer & Open Pre-filled Google Form
  const handleAcceptOffer = async () => {
    setErrorMsg("");
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || spinAuthToken;

      const res = await acceptSpinReward({
        data: {
          authToken: token,
        },
      });

      if (!res.success) {
        setErrorMsg(res.message || "Unable to accept reward.");
        return;
      }

      if (res.formUrl) {
        setFormUrl(res.formUrl);
        try {
          window.open(res.formUrl, "_blank", "noopener,noreferrer");
        } catch {}
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(SESSION_COMPLETED_KEY, "true");
      }
      setStep("accepted_form");
      fireConfetti();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to accept reward offer.");
    } finally {
      setLoading(false);
    }
  };

  // Step 4B: Reject Offer
  const handleRejectOffer = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || spinAuthToken;
      await rejectSpinReward({ data: { authToken: token } });
    } catch {}
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_COMPLETED_KEY, "true");
    }
    setIsOpen(false);
  };

  // Step 5: Submit Claim Form
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || trimmedPhone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit WhatsApp or mobile number.");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || spinAuthToken;

      const res = await claimSpinReward({
        data: {
          authToken: token,
          phone: trimmedPhone,
          college: college.trim(),
          claimNotes: claimNotes.trim(),
        },
      });

      if (!res.success) {
        setErrorMsg(res.message || "Failed to submit claim.");
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(SESSION_COMPLETED_KEY, "true");
      }
      setStep("claimed_success");
      fireConfetti();
    } catch (err: any) {
      setErrorMsg(err.message || "Error submitting claim.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!voucherCode) return;
    navigator.clipboard.writeText(voucherCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const whatsappNumber = "919876543210";
  const whatsappText = encodeURIComponent(
    `Hi Micrylis Team! I won "${wonReward?.title || "Special Reward"}" on the Spin & Win wheel. My voucher code is: ${voucherCode}. Name: ${name}, Email: ${email}. Please help me redeem this.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

  return (
    <>
      {/* Floating Gift Trigger (Website theme: sleek card pill) */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsOpen(true);
            setErrorMsg("");
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full border border-border/80 bg-surface-elevated px-4 py-2.5 text-xs font-semibold text-foreground shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition hover:border-student hover:text-student"
          title="Spin & Win"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-student text-student-foreground">
            <Gift className="h-3.5 w-3.5 animate-bounce" />
          </div>
          <span className="font-display font-medium tracking-wide">Spin & Win</span>
          <span className="h-1.5 w-1.5 rounded-full bg-startup" />
        </motion.button>
      )}

      {/* Main Master Popup Modal (Editorial Theme Matching Micrylis) */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-foreground/40 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border/90 bg-card text-card-foreground shadow-[0_20px_60px_-15px_rgba(0,0,0,0.18)]"
            >
              {/* Brand Tricolor Top Stripe */}
              <div className="h-1.5 w-full bg-gradient-to-r from-student via-startup to-researcher" />

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-20 rounded-full border border-border/60 bg-surface p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="p-6 sm:p-8">
                {/* ─── EXPIRED STATE (AFTER 20 NOV 2026) ─── */}
                {isSpinOfferExpired() ? (
                  <div className="text-center py-6">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Clock className="h-6 w-6" />
                    </div>
                    <h2 className="font-display text-2xl font-bold text-foreground">
                      Campaign Concluded
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      The Spin & Win promotional event ended on{" "}
                      <strong className="text-foreground">{SPIN_EXPIRY_LABEL}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="mt-6 rounded-xl border border-border bg-background px-6 py-2.5 text-xs font-semibold text-foreground hover:bg-accent"
                    >
                      Return to Website
                    </button>
                  </div>
                ) : (
                  <>
                    {/* ─── STEP 1: INTRO & LEAD FORM ─── */}
                    {step === "intro" && (
                      <div>
                        <div className="text-center">
                          <div className="mx-auto mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-startup/30 bg-startup-soft px-3 py-0.5 text-[11px] font-semibold text-startup">
                            <Clock className="h-3 w-3" />
                            Valid Until {SPIN_EXPIRY_LABEL}
                          </div>

                          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            Spin & Win Guaranteed Rewards
                          </h2>
                          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                            Win up to <span className="font-semibold text-foreground">50% program discount</span>, 1-on-1 mentorship, or a 100% full project scholarship.
                          </p>
                        </div>

                        {/* Prizes Overview Badges */}
                        <div className="my-5 grid grid-cols-2 gap-2 text-xs">
                          {SPIN_REWARDS.slice(0, 4).map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center gap-2 rounded-xl border border-border/80 bg-surface p-2.5"
                            >
                              <div
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: r.color }}
                              />
                              <span className="font-medium text-foreground truncate">{r.title}</span>
                            </div>
                          ))}
                        </div>

                        <form onSubmit={handleRequestOtp} className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-medium text-foreground/80 mb-1">
                              Your Full Name
                            </label>
                            <input
                              type="text"
                              required
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="e.g. Priyanshu Sharma"
                              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none transition"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-foreground/80 mb-1">
                              Email Address (OTP will be sent here)
                            </label>
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="you@domain.com"
                              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none transition"
                            />
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Strict rule: Exactly 1 spin per verified email.
                            </p>
                          </div>

                          {errorMsg && (
                            <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                              <span>{errorMsg}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition disabled:opacity-50"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Sending Verification Code...
                              </>
                            ) : (
                              <>
                                Send Verification Code
                                <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* ─── STEP 2: OTP VERIFICATION (Clean, Empty 6-digit Input) ─── */}
                    {step === "otp" && (
                      <div className="text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-student-soft text-student">
                          <Mail className="h-6 w-6" />
                        </div>
                        <h3 className="font-display text-xl font-bold text-foreground">
                          Check Your Email Inbox
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          We sent a 6-digit code to <strong className="text-foreground">{email}</strong>.
                        </p>

                        <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                          <div>
                            <input
                              type="text"
                              maxLength={6}
                              autoFocus
                              required
                              value={otpCode}
                              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                              placeholder="• • • • • •"
                              className="w-full text-center tracking-[12px] font-mono text-3xl font-bold rounded-xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground/40 focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none transition"
                            />
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                              Enter the 6 numbers received on your email.
                            </p>
                          </div>

                          {errorMsg && (
                            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                              {errorMsg}
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={loading || otpCode.trim().length !== 6}
                            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-40"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            ) : (
                              "Verify & Unlock Wheel"
                            )}
                          </button>

                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setStep("intro");
                                setErrorMsg("");
                              }}
                              className="hover:text-foreground underline underline-offset-4"
                            >
                              Change Email
                            </button>
                            <button
                              type="button"
                              disabled={resendCooldown > 0 || loading}
                              onClick={handleResendOtp}
                              className="text-student hover:underline disabled:text-muted-foreground/50 disabled:no-underline"
                            >
                              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* ─── ALREADY SPUN STATE (PREVENTS DUPLICATE) ─── */}
                    {step === "already_spun" && existingEntry && (
                      <div className="text-center py-2">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-startup-soft text-startup">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <h3 className="font-display text-xl font-bold text-foreground">
                          Already Participated!
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <strong className="text-foreground">{existingEntry.email}</strong> has already spun the wheel. Each verified participant is entitled to exactly 1 spin.
                        </p>

                        <div className="my-5 rounded-xl border border-border bg-surface p-4 text-left">
                          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                            Your Won Reward:
                          </div>
                          <div className="mt-1 text-lg font-bold text-foreground font-display">
                            {existingEntry.rewardTitle}
                          </div>
                          <div className="mt-3 flex items-center justify-between rounded-lg bg-background px-3 py-2 border border-border">
                            <span className="font-mono text-sm text-foreground font-bold">
                              {existingEntry.voucherCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(existingEntry.voucherCode);
                                setCopiedCode(true);
                                setTimeout(() => setCopiedCode(false), 2000);
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              {copiedCode ? <Check className="h-3.5 w-3.5 text-researcher" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedCode ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <div>
                              Reward Status:{" "}
                              <span className="font-semibold text-foreground">
                                {existingEntry.rewardStatus || existingEntry.status}
                              </span>
                            </div>
                            {existingEntry.formStatus && existingEntry.formStatus !== "NOT_APPLICABLE" && (
                              <div>
                                • Form Status:{" "}
                                <span className="font-semibold text-foreground">
                                  {existingEntry.formStatus}
                                </span>
                              </div>
                            )}
                          </div>

                          {existingEntry.formUrl && existingEntry.rewardStatus === "ACCEPTED" && (
                            <div className="mt-2.5 pt-2 border-t border-border">
                              <a
                                href={existingEntry.formUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-student hover:underline"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Open Verification Form
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleClose}
                          className="w-full rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground hover:bg-accent"
                        >
                          Continue to Website
                        </button>
                      </div>
                    )}

                    {/* ─── STEP 3: SMOOTH WHEEL ARENA ─── */}
                    {step === "wheel" && (
                      <div className="text-center">
                        <div className="mb-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-student">
                            Verified: {email}
                          </span>
                          <h3 className="font-display text-2xl font-bold text-foreground mt-0.5">
                            Spin the Wheel!
                          </h3>
                        </div>

                        {/* Hardware-Accelerated SVG Wheel */}
                        <div className="my-3 flex justify-center">
                          <SpinWheelCanvas
                            size={320}
                            isSpinning={isSpinning}
                            winningIndex={winningIndex}
                            onSpinComplete={handleSpinComplete}
                          />
                        </div>

                        {errorMsg && (
                          <div className="mb-3 text-xs text-destructive">{errorMsg}</div>
                        )}

                        <button
                          type="button"
                          disabled={isSpinning || loading || winningIndex !== null}
                          onClick={handleSpinClick}
                          className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition disabled:opacity-50"
                        >
                          {isSpinning ? "Spinning..." : "SPIN NOW"}
                        </button>
                      </div>
                    )}

                    {/* ─── STEP 4: WON OFFER POPUP (2 BUTTONS: CLAIM OR REJECT) ─── */}
                    {step === "won_modal" && wonReward && (
                      <div className="text-center py-1">
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-startup-soft text-startup">
                          <Sparkles className="h-6 w-6" />
                        </div>

                        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-student">
                          Congratulations {name}!
                        </span>
                        <h3 className="font-display text-2xl sm:text-3xl font-bold text-foreground mt-1">
                          {wonReward.claimHeadline}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {wonReward.claimSubtitle}
                        </p>

                        {/* Voucher Card */}
                        <div className="my-5 rounded-xl border border-border bg-surface p-4 text-center">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Unique Voucher Code
                          </div>
                          <div className="mt-1.5 flex items-center justify-center gap-2">
                            <span className="font-mono text-2xl font-black text-foreground">
                              {voucherCode}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyCode}
                              className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground"
                              title="Copy Code"
                            >
                              {copiedCode ? <Check className="h-4 w-4 text-researcher" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">{wonReward.terms}</p>
                        </div>

                        {/* TWO REQUIRED BUTTONS:
                            1. Accept Offer & Open Pre-filled Google Form
                            2. Reject / decline button */}
                        <div className="space-y-2.5">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={handleAcceptOffer}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 shadow-md transition disabled:opacity-50"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Accepting Reward...
                              </>
                            ) : (
                              <>
                                Accept Offer & Fill Google Form
                                <ExternalLink className="h-4 w-4" />
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={loading}
                            onClick={handleRejectOffer}
                            className="w-full rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition disabled:opacity-50"
                          >
                            No Thanks, Return to Landing Page
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 4B: ACCEPTED FORM STATUS (GOOGLE FORMS WORKFLOW) ─── */}
                    {step === "accepted_form" && wonReward && (
                      <div className="text-center py-2">
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-student-soft text-student">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-500 mb-1.5">
                          Form Verification Pending
                        </div>
                        <h3 className="font-display text-2xl font-bold text-foreground">
                          Reward Accepted!
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Please complete your pre-filled Google Form submission for <strong className="text-foreground">{wonReward.title}</strong>.
                        </p>

                        {/* Voucher Card */}
                        <div className="my-4 rounded-xl border border-border bg-surface p-3.5 text-center">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Your Voucher Code
                          </div>
                          <div className="mt-1 flex items-center justify-center gap-2">
                            <span className="font-mono text-xl font-black text-foreground">
                              {voucherCode}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopyCode}
                              className="rounded-md border border-border bg-background p-1 text-muted-foreground hover:text-foreground"
                              title="Copy Code"
                            >
                              {copiedCode ? <Check className="h-3.5 w-3.5 text-researcher" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{wonReward.terms}</p>
                        </div>

                        {/* Automated Webhook & Next Steps Notice */}
                        <div className="rounded-xl border border-border/80 bg-background/50 p-3 text-left text-xs text-muted-foreground mb-4">
                          <div className="font-semibold text-foreground flex items-center gap-1 mb-0.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-student" />
                            Automated Webhook Verification
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            Once you submit the Google Form, our secure webhook will automatically register your verification. An administrator will review your redemption.
                          </p>
                        </div>

                        <div className="space-y-2">
                          {formUrl && (
                            <a
                              href={formUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm transition"
                            >
                              Open Google Form Again
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={handleClose}
                            className="w-full rounded-xl border border-border bg-background py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition"
                          >
                            Close & Continue Browsing
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ─── STEP 5: CLAIM REGISTRATION FORM ─── */}
                    {step === "claim_form" && wonReward && (
                      <div>
                        <div className="text-center mb-5">
                          <h3 className="font-display text-xl font-bold text-foreground">
                            Claim Registration
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Reward: <strong className="text-foreground">{wonReward.title}</strong> ({voucherCode})
                          </p>
                        </div>

                        <form onSubmit={handleSubmitClaim} className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-medium text-foreground/70 mb-1">
                              Name
                            </label>
                            <input
                              type="text"
                              disabled
                              value={name}
                              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-muted-foreground cursor-not-allowed"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-foreground/70 mb-1">
                              Verified Email
                            </label>
                            <input
                              type="email"
                              disabled
                              value={email}
                              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-muted-foreground cursor-not-allowed"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                              WhatsApp / Mobile Number *
                            </label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <input
                                type="tel"
                                required
                                placeholder="e.g. 9876543210"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full rounded-xl border border-input bg-background px-3.5 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                              College / University / Company (Optional)
                            </label>
                            <div className="relative">
                              <School className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="e.g. IIT Bombay, Delhi University"
                                value={college}
                                onChange={(e) => setCollege(e.target.value)}
                                className="w-full rounded-xl border border-input bg-background px-3.5 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                              What topic interests you most? (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Bioinformatics, AI Drug Discovery, Career Mentorship"
                              value={claimNotes}
                              onChange={(e) => setClaimNotes(e.target.value)}
                              className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none"
                            />
                          </div>

                          {errorMsg && (
                            <div className="text-xs text-destructive">{errorMsg}</div>
                          )}

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                            ) : (
                              "Confirm & Activate Reward"
                            )}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* ─── STEP 6: CLAIM SUCCESS ─── */}
                    {step === "claimed_success" && (
                      <div className="text-center py-4">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-researcher-soft text-researcher">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <h3 className="font-display text-2xl font-bold text-foreground">
                          Reward Registered!
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Voucher <strong className="text-foreground">{voucherCode}</strong> has been linked to <strong className="text-foreground">{wonReward?.title}</strong>.
                        </p>

                        <div className="my-6 space-y-3">
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-105 transition"
                          >
                            Redeem on WhatsApp Now
                            <ExternalLink className="h-4 w-4" />
                          </a>

                          <button
                            type="button"
                            onClick={handleClose}
                            className="w-full rounded-xl border border-border bg-background py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                          >
                            Close & Continue Browsing
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
