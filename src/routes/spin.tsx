import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Gift,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  Phone,
  School,
  ExternalLink,
  QrCode,
  Download,
  FileText,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SpinWheelCanvas } from "@/components/spin-wheel/SpinWheelCanvas";
import {
  SPIN_REWARDS,
  isSpinOfferExpired,
  SPIN_EXPIRY_LABEL,
  getExpiryCountdown,
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

export const Route = createFileRoute("/spin")({
  component: SpinPage,
  head: () => ({
    meta: [
      { title: "Spin & Win Exclusive Rewards — Micrylis Biotech" },
      {
        name: "description",
        content:
          "Spin the Micrylis wheel to unlock certified course discounts, free 1-on-1 mentorship, live founder calls, or a 100% full project scholarship.",
      },
    ],
  }),
});

function SpinPage() {
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

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [college, setCollege] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [formUrl, setFormUrl] = useState("");

  // UI state
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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Submit Name & Email -> Send OTP
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
      // Check if email already spun (PII-safe)
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

      // Request OTP via native Supabase Auth Email OTP
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

  // Step 3: Trigger Server-Authoritative Wheel Spin (Zero-Trust Session Authenticated)
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
      setErrorMsg(err.message || "Could not spin the wheel.");
    } finally {
      setLoading(false);
    }
  };

  const handleSpinComplete = () => {
    setIsSpinning(false);
    fireConfetti();
    setTimeout(() => {
      setStep("won_modal");
    }, 600);
  };

  // Step 4A: User Accepts Offer & Opens Pre-filled Google Form
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

      setStep("accepted_form");
      fireConfetti();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to accept reward offer.");
    } finally {
      setLoading(false);
    }
  };

  // Step 4B: User Rejects
  const handleRejectOffer = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || spinAuthToken;
      await rejectSpinReward({ data: { authToken: token } });
    } catch {}
    window.location.href = "/";
  };

  // Step 5: Claim Submit
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || trimmedPhone.length < 10) {
      setErrorMsg("Please enter a valid WhatsApp or phone number.");
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
    `Hi Micrylis! I won the "${wonReward?.title || "Special Reward"}" on the Spin & Win wheel. My voucher code is: ${voucherCode}. Name: ${name}, Email: ${email}. Please help me redeem this.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Header Title */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-student/30 bg-student-soft px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-student mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Official Promotional Event
          </div>
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-startup/40 bg-startup-soft px-3 py-1 text-xs font-bold text-startup">
              ⚡ Limited Offer Valid Until {SPIN_EXPIRY_LABEL}
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
            Micrylis Spin & Win
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Verify your email to unlock your verified spin. Win exclusive research scholarships, discounts, and personalized mentorship.
          </p>
        </div>

        {/* Content Card */}
        <div className="rounded-2xl border border-border/90 bg-card text-card-foreground shadow-2xl p-6 sm:p-10 max-w-xl mx-auto">
          {/* EXPIRED STATE (AFTER 20 NOV 2026) */}
          {isSpinOfferExpired() ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">Promotional Offer Ended</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                This Spin & Win promotional event expired on <strong className="text-foreground">{SPIN_EXPIRY_LABEL}</strong>.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Thank you for your interest! Keep an eye on our website for future scholarships and workshop announcements.
              </p>
              <a
                href="/"
                className="mt-6 inline-block rounded-xl border border-border bg-background px-6 py-2.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                Return to Home Page
              </a>
            </div>
          ) : (
            <>
          {/* STEP 1: FORM */}
          {step === "intro" && (
            <div>
              <div className="text-center mb-6">
                <h2 className="font-display text-xl font-bold text-foreground">Participant Verification</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your details to receive your 6-digit spin access code.
                </p>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priyanshu Sharma"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Strict policy: Exactly 1 spin per verified email address.
                  </p>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending Verification Code...
                    </>
                  ) : (
                    <>
                      Verify & Unlock Spin
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: OTP */}
          {step === "otp" && (
            <div>
              <div className="text-center mb-6">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-student-soft text-student">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">Check Your Email</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the 6-digit verification code sent to <strong className="text-foreground">{email}</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="• • • • • •"
                  className="w-full text-center tracking-[12px] font-mono text-3xl font-bold rounded-xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground/40 focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none"
                />

                {errorMsg && (
                  <div className="text-xs text-destructive text-center">{errorMsg}</div>
                )}

                <button
                  type="submit"
                  disabled={loading || otpCode.trim().length !== 6}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirm Code & Go to Wheel"
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
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

          {/* ALREADY SPUN */}
          {step === "already_spun" && existingEntry && (
            <div className="text-center py-4">
              <h3 className="font-display text-xl font-bold text-foreground">You've Already Spun!</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Each verified email can only spin once. Here is the record of your reward:
              </p>

              <div className="my-6 rounded-xl border border-border bg-surface p-5 text-left">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Won Prize:
                </div>
                <div className="mt-1 text-xl font-bold text-foreground font-display">
                  {existingEntry.rewardTitle}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-background p-3 border border-border">
                  <span className="font-mono text-base text-foreground font-bold">
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
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
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
                  <div className="mt-3 pt-3 border-t border-border">
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

              <a
                href="/"
                className="inline-block rounded-xl border border-border bg-background px-6 py-2.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                Back to Home
              </a>
            </div>
          )}

          {/* STEP 3: WHEEL */}
          {step === "wheel" && (
            <div className="text-center">
              <div className="mb-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-student">
                  Participant: {email}
                </span>
                <h3 className="font-display text-2xl font-bold text-foreground mt-0.5">
                  Spin to Win Your Reward!
                </h3>
              </div>

              <div className="my-4 flex justify-center">
                <SpinWheelCanvas
                  size={340}
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
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
              >
                {isSpinning ? "Spinning..." : "SPIN NOW"}
              </button>
            </div>
          )}

          {/* STEP 4: WON MODAL WITH 2 BUTTONS: CLAIM FORM & REJECT */}
          {step === "won_modal" && wonReward && (
            <div className="text-center py-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-student">
                Congratulations {name || "Winner"}!
              </span>
              <h3 className="font-display mt-1 text-2xl sm:text-3xl font-bold text-foreground">
                {wonReward.claimHeadline}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {wonReward.claimSubtitle}
              </p>

              {/* Voucher Box */}
              <div className="my-6 rounded-xl border border-border bg-surface p-5 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Your Voucher Code
                </div>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl font-black text-foreground">
                    {voucherCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="rounded-md border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
                  >
                    {copiedCode ? <Check className="h-4 w-4 text-researcher" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{wonReward.terms}</p>
              </div>

              {/* TWO REQUIRED BUTTONS:
                  1. Accept Offer & Open Google Form
                  2. Reject */}
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAcceptOffer}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 shadow-md transition disabled:opacity-50"
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
                  No Thanks, Return to Home
                </button>
              </div>
            </div>
          )}

          {/* STEP 4B: ACCEPTED FORM STATUS (GOOGLE FORMS WORKFLOW) */}
          {step === "accepted_form" && wonReward && (
            <div className="text-center py-4">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-student-soft text-student">
                <FileText className="h-7 w-7" />
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500 mb-2">
                Form Verification Pending
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                Reward Offer Accepted!
              </h3>
              <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto">
                We opened your pre-filled Google Form in a new tab. Please submit the form to finalize your registration for <strong className="text-foreground">{wonReward.title}</strong>.
              </p>

              {/* Voucher Box */}
              <div className="my-5 rounded-xl border border-border bg-surface p-4 text-center">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Your Unique Voucher Code
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

              {/* Automated Webhook & Next Steps Notice */}
              <div className="rounded-xl border border-border/80 bg-background/50 p-4 text-left text-xs text-muted-foreground mb-6">
                <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-student" />
                  Automated Webhook Verification
                </div>
                <p className="text-[11px] leading-relaxed">
                  Upon submitting the Google Form, our secure webhook will automatically link your submission to voucher <strong className="text-foreground">{voucherCode}</strong>. An administrator will verify the submission and mark your reward ready for redemption.
                </p>
              </div>

              <div className="space-y-3">
                {formUrl && (
                  <a
                    href={formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm transition"
                  >
                    Open Google Form Again
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}

                <a
                  href="/"
                  className="block w-full rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition"
                >
                  Return to Home Page
                </a>
              </div>
            </div>
          )}

          {/* STEP 5: CLAIM FORM */}
          {step === "claim_form" && wonReward && (
            <div>
              <div className="text-center mb-6">
                <h3 className="font-display text-xl font-bold text-foreground">Activate Your Reward</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Claiming: <strong className="text-foreground">{wonReward.title}</strong> ({voucherCode})
                </p>
              </div>

              <form onSubmit={handleSubmitClaim} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Participant Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={name}
                    className="mt-1 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Verified Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="mt-1 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                    WhatsApp / Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                    College / Institution / Organization (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IIT Delhi, BITS Pilani"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                    What research area or goal interests you most? (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bioinformatics, AI Drug Discovery, Career Mentorship"
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:ring-2 focus:ring-student/20 focus:outline-none"
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
                    "Confirm & Submit Claim"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* STEP 6: CLAIM SUCCESS */}
          {step === "claimed_success" && (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-researcher-soft text-researcher">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground">Reward Activated!</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Your voucher <strong className="text-foreground">{voucherCode}</strong> has been registered. You can connect with our team immediately on WhatsApp to redeem it.
              </p>

              <div className="my-6 space-y-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:brightness-105 transition"
                >
                  Redeem on WhatsApp Now
                  <ExternalLink className="h-4 w-4" />
                </a>

                <a
                  href="/"
                  className="block w-full rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Explore Micrylis Programs
                </a>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Reward Categories Grid */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="font-display text-xl font-bold text-foreground text-center mb-6">
            Reward Categories & Benefits
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {SPIN_REWARDS.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-card p-4 transition hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold text-white tracking-wide"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.shortLabel}
                  </span>
                  <Gift className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
                <div className="mt-2 font-display font-bold text-foreground text-sm">{r.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{r.description}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

