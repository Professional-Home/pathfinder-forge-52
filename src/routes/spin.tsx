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
  sendSpinOtp,
  verifySpinOtp,
  executeSpinRoll,
  claimSpinReward,
  rejectSpinReward,
} from "@/lib/spin-wheel-server";

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
    "intro" | "otp" | "already_spun" | "wheel" | "won_modal" | "claim_form" | "claimed_success"
  >("intro");

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [college, setCollege] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [otpCode, setOtpCode] = useState("");

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
      // Check if email already spun
      const checkRes = await checkEmailSpun({ data: { email: trimmedEmail } });
      if (checkRes.alreadySpun && checkRes.entry) {
        setExistingEntry(checkRes.entry);
        setStep("already_spun");
        setLoading(false);
        return;
      }

      // Send OTP
      const sendRes = await sendSpinOtp({
        data: { name: trimmedName, email: trimmedEmail },
      });

      if (!sendRes.success) {
        setErrorMsg(sendRes.message || "Failed to send code.");
        return;
      }

      if ((sendRes as any).devOtp) {
        setOtpCode((sendRes as any).devOtp);
      }

      setStep("otp");
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (otpCode.trim().length !== 6) {
      setErrorMsg("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifySpinOtp({
        data: { email: email.trim().toLowerCase(), otp: otpCode.trim() },
      });

      if (!res.success) {
        setErrorMsg(res.message || "Invalid verification code.");
        return;
      }

      setStep("wheel");
    } catch (err: any) {
      setErrorMsg(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await sendSpinOtp({
        data: { name: name.trim(), email: email.trim().toLowerCase() },
      });
      if (res.success) setResendCooldown(60);
      else setErrorMsg(res.message);
    } catch (err: any) {
      setErrorMsg(err.message || "Unable to resend.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Trigger Server-Authoritative Wheel Spin
  const handleSpinClick = async () => {
    if (isSpinning || wonReward) return;

    setErrorMsg("");
    setLoading(true);

    try {
      const rollRes = await executeSpinRoll({
        data: { name: name.trim(), email: email.trim().toLowerCase() },
      });

      if (!rollRes.success) {
        setErrorMsg(rollRes.message || "Spin failed.");
        if (rollRes.code === "ALREADY_SPUN" && rollRes.entry) {
          setExistingEntry(rollRes.entry as any);
          setStep("already_spun");
        }
        return;
      }

      setWinningIndex(rollRes.winningIndex);
      setWonReward(rollRes.reward);
      setVoucherCode(rollRes.voucherCode);
      setIsSpinning(true);
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

  // Step 4: User Rejects
  const handleRejectOffer = async () => {
    try {
      await rejectSpinReward({ data: { email: email.trim().toLowerCase() } });
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
      const res = await claimSpinReward({
        data: {
          email: email.trim().toLowerCase(),
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
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            Official Promotional Event
          </div>
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
              ⚡ Limited Offer Valid Until {SPIN_EXPIRY_LABEL}
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Micrylis Spin & Win
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">
            Verify your email to unlock your verified spin. Win exclusive research scholarships, discounts, and personalized mentorship.
          </p>
        </div>

        {/* Content Card */}
        <div className="rounded-2xl border border-cyan-500/30 bg-[#0b0f19] shadow-2xl p-6 sm:p-10 max-w-xl mx-auto">
          {/* EXPIRED STATE (AFTER 20 NOV 2026) */}
          {isSpinOfferExpired() ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-white">Promotional Offer Ended</h2>
              <p className="mt-2 text-xs text-slate-300">
                This Spin & Win promotional event expired on <strong className="text-amber-400">{SPIN_EXPIRY_LABEL}</strong>.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Thank you for your interest! Keep an eye on our website for future scholarships and workshop announcements.
              </p>
              <a
                href="/"
                className="mt-6 inline-block rounded-lg bg-slate-800 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
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
                <h2 className="text-xl font-bold text-white">Participant Verification</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your details to receive your 6-digit spin access code.
                </p>
              </div>

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priyanshu Sharma"
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Strict policy: Exactly 1 spin per verified email address.
                  </p>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-500 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition disabled:opacity-50"
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
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Check Your Email</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Enter the 6-digit verification code sent to <strong className="text-cyan-300">{email}</strong>.
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
                  placeholder="••••••"
                  className="w-full text-center tracking-[12px] font-mono text-3xl font-bold rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-cyan-400 placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                />

                {errorMsg && (
                  <div className="text-xs text-rose-400 text-center">{errorMsg}</div>
                )}

                <button
                  type="submit"
                  disabled={loading || otpCode.trim().length !== 6}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-500 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirm Code & Go to Wheel"
                  )}
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("intro");
                      setErrorMsg("");
                    }}
                    className="hover:text-white"
                  >
                    Change Email
                  </button>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || loading}
                    onClick={handleResendOtp}
                    className="text-cyan-400 hover:text-cyan-300 disabled:text-slate-600"
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
              <h3 className="text-xl font-bold text-white">You've Already Spun!</h3>
              <p className="mt-2 text-xs text-slate-400">
                Each verified email can only spin once. Here is the record of your reward:
              </p>

              <div className="my-6 rounded-xl border border-cyan-500/30 bg-slate-900/80 p-5 text-left">
                <div className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
                  Won Prize:
                </div>
                <div className="mt-1 text-xl font-black text-white">
                  {existingEntry.rewardTitle}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <span className="font-mono text-base text-cyan-300 font-bold">
                    {existingEntry.voucherCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(existingEntry.voucherCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedCode ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Status: <span className="capitalize text-slate-200">{existingEntry.status}</span>
                </div>
              </div>

              <a
                href="/"
                className="inline-block rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Back to Home
              </a>
            </div>
          )}

          {/* STEP 3: WHEEL */}
          {step === "wheel" && (
            <div className="text-center">
              <div className="mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  Participant: {email}
                </span>
                <h3 className="text-2xl font-black text-white">
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
                <div className="mb-3 text-xs text-rose-400">{errorMsg}</div>
              )}

              <button
                type="button"
                disabled={isSpinning || loading || winningIndex !== null}
                onClick={handleSpinClick}
                className="w-full rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 py-4 text-base font-black text-white shadow-xl shadow-rose-500/30 transition hover:brightness-110 disabled:opacity-50"
              >
                {isSpinning ? "SPINNING THE WHEEL..." : "★ SPIN THE WHEEL NOW ★"}
              </button>
            </div>
          )}

          {/* STEP 4: WON MODAL WITH 2 BUTTONS: CLAIM FORM & REJECT */}
          {step === "won_modal" && wonReward && (
            <div className="text-center py-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-400">
                Congratulations {name || "Winner"}!
              </span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-black text-white">
                {wonReward.claimHeadline}
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                {wonReward.claimSubtitle}
              </p>

              {/* Voucher Box */}
              <div className="my-6 rounded-xl border border-cyan-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-5 text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Your Voucher Code
                </div>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl font-black text-cyan-300">
                    {voucherCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="rounded-md bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">{wonReward.terms}</p>
              </div>

              {/* TWO REQUIRED BUTTONS:
                  1. Claim Offer (Form fill)
                  2. Reject */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStep("claim_form")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-3.5 text-sm font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/20"
                >
                  Claim Offer & Fill Details
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleRejectOffer}
                  className="w-full rounded-lg border border-slate-700 bg-transparent py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  No Thanks, Return to Home
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: CLAIM FORM */}
          {step === "claim_form" && wonReward && (
            <div>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white">Activate Your Reward</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Claiming: <strong className="text-cyan-300">{wonReward.title}</strong> ({voucherCode})
                </p>
              </div>

              <form onSubmit={handleSubmitClaim} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Participant Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={name}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Verified Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    WhatsApp / Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    College / Institution / Organization (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IIT Delhi, BITS Pilani"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    What research area or goal interests you most? (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bioinformatics, AI Drug Discovery, Career Mentorship"
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {errorMsg && (
                  <div className="text-xs text-rose-400">{errorMsg}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-emerald-500 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
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
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-black text-white">Reward Activated!</h3>
              <p className="mt-2 text-xs text-slate-300">
                Your voucher <strong className="text-cyan-300">{voucherCode}</strong> has been registered. You can connect with our team immediately on WhatsApp to redeem it.
              </p>

              <div className="my-6 space-y-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500"
                >
                  Redeem on WhatsApp Now
                  <ExternalLink className="h-4 w-4" />
                </a>

                <a
                  href="/"
                  className="block w-full rounded-lg border border-slate-800 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Explore Micrylis Programs
                </a>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Prize Transparency Grid */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-white text-center mb-6">
            Reward Categories & Probability Distribution
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {SPIN_REWARDS.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4 transition hover:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[11px] font-bold text-white"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.shortLabel}
                  </span>
                  <span className="text-xs font-mono font-semibold text-cyan-400">
                    {r.probability}% Chance
                  </span>
                </div>
                <div className="mt-2 font-bold text-white text-sm">{r.title}</div>
                <div className="mt-1 text-xs text-slate-400">{r.description}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

