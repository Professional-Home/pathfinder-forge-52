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
  Send,
  ExternalLink,
  ShieldCheck,
  Percent,
  Clock,
  Phone,
  School,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SpinWheelCanvas } from "./SpinWheelCanvas";
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

const SESSION_DISMISSED_KEY = "micrylis_spin_modal_dismissed";
const SESSION_COMPLETED_KEY = "micrylis_spin_modal_completed";

export function SpinWinPopupModal() {
  const [isOpen, setIsOpen] = useState(false);
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
  const [existingEntry, setExistingEntry] = useState<SpinWheelEntry | null>(null);

  // Auto-open on website entry (if not already opened/dismissed in this session, and NOT expired)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isSpinOfferExpired()) return;

    const isDismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY);
    const isCompleted = sessionStorage.getItem(SESSION_COMPLETED_KEY);

    if (!isDismissed && !isCompleted) {
      // 1.8 second natural delay so user sees page first
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Dismiss / Close
  const handleClose = () => {
    setIsOpen(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, "true");
    }
  };

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
      // 1. Check if email already spun
      const checkRes = await checkEmailSpun({ data: { email: trimmedEmail } });
      if (checkRes.alreadySpun && checkRes.entry) {
        setExistingEntry(checkRes.entry);
        setStep("already_spun");
        setLoading(false);
        return;
      }

      // 2. Send OTP
      const sendRes = await sendSpinOtp({
        data: { name: trimmedName, email: trimmedEmail },
      });

      if (!sendRes.success) {
        if (sendRes.code === "ALREADY_SPUN") {
          setErrorMsg(sendRes.message);
          return;
        }
        setErrorMsg(sendRes.message || "Failed to send code. Please try again.");
        return;
      }

      if ((sendRes as any).devOtp) {
        setOtpCode((sendRes as any).devOtp);
      }

      setStep("otp");
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
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

      // Verified! Transition to the Spin Wheel
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
      if (res.success) {
        setResendCooldown(60);
      } else {
        setErrorMsg(res.message);
      }
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

      // Store the server's rolled outcome
      setWinningIndex(rollRes.winningIndex);
      setWonReward(rollRes.reward);
      setVoucherCode(rollRes.voucherCode);

      // Start the physical wheel rotation
      setIsSpinning(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not spin the wheel.");
    } finally {
      setLoading(false);
    }
  };

  // Wheel animation completed callback
  const handleSpinComplete = () => {
    setIsSpinning(false);
    fireConfetti();
    setTimeout(() => {
      setStep("won_modal");
    }, 600);
  };

  // Step 4: User Rejects Offer
  const handleRejectOffer = async () => {
    try {
      await rejectSpinReward({ data: { email: email.trim().toLowerCase() } });
    } catch {}
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_COMPLETED_KEY, "true");
    }
    setIsOpen(false);
  };

  // Step 4: User Accepts -> Proceed to Claim Form
  const handleProceedToClaim = () => {
    setStep("claim_form");
  };

  // Step 5: Submit Claim Form
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || trimmedPhone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit WhatsApp or phone number.");
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

  // Copy voucher code
  const handleCopyCode = () => {
    if (!voucherCode) return;
    navigator.clipboard.writeText(voucherCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // WhatsApp claim URL
  const whatsappNumber = "919876543210";
  const whatsappText = encodeURIComponent(
    `Hi Micrylis Team! I won the "${wonReward?.title || "Special Reward"}" on the Spin & Win wheel. My voucher code is: ${voucherCode}. Name: ${name}, Email: ${email}. Please help me redeem this.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

  return (
    <>
      {/* Floating Gift Trigger in bottom-right corner if modal was closed */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setIsOpen(true);
            setErrorMsg("");
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 font-semibold text-white shadow-2xl shadow-cyan-500/30 ring-2 ring-white/20 transition-all hover:shadow-cyan-500/50"
          title="Spin & Win Rewards"
        >
          <Gift className="h-5 w-5 animate-bounce" />
          <span className="text-sm font-bold tracking-wide">Spin & Win!</span>
        </motion.button>
      )}

      {/* Main Master Popup Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#0b0f19] text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.2)]"
            >
              {/* Glowing Top Banner */}
              <div className="h-2 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-20 rounded-full bg-slate-800/80 p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="p-6 sm:p-8">
                {/* ─── EXPIRED STATE (AFTER 20 NOVEMBER 2026) ─── */}
                {isSpinOfferExpired() ? (
                  <div className="text-center py-4">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                      <Clock className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Event Concluded</h2>
                    <p className="mt-2 text-xs text-slate-400">
                      The Spin & Win promotional campaign ended on{" "}
                      <strong className="text-amber-400">{SPIN_EXPIRY_LABEL}</strong>.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Stay connected with Micrylis for future research opportunities and workshops.
                    </p>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="mt-6 w-full rounded-lg bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      Close & Explore Website
                    </button>
                  </div>
                ) : (
                  <>
                {/* ─── STEP 1: INTRO & LEAD FORM ─── */}
                {step === "intro" && (
                  <div>
                    <div className="text-center">
                      <div className="mx-auto mb-2 flex items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                          <Clock className="h-3 w-3" />
                          Valid Until {SPIN_EXPIRY_LABEL}
                        </span>
                      </div>
                      <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                        Spin & Win Guaranteed Rewards!
                      </h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Unlock up to <span className="font-semibold text-cyan-300">50% discount</span>, free mentorship sessions, or a 100% full project scholarship.
                      </p>
                    </div>

                    {/* Quick Preview of Prizes */}
                    <div className="my-5 grid grid-cols-2 gap-2 text-xs">
                      {SPIN_REWARDS.slice(0, 4).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5"
                        >
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: r.color }}
                          />
                          <span className="font-medium text-slate-200 truncate">{r.title}</span>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleRequestOtp} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                          Your Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. John Doe"
                          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                          Email Address (OTP will be sent here)
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@university.edu or you@gmail.com"
                          className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          Strict limit: Exactly 1 spin per verified email.
                        </p>
                      </div>

                      {errorMsg && (
                        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-blue-500 disabled:opacity-60"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending Verification Code...
                          </>
                        ) : (
                          <>
                            Verify Email & Unlock Spin
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* ─── STEP 2: OTP VERIFICATION ─── */}
                {step === "otp" && (
                  <div>
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-bold text-white">Enter Verification Code</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        We sent a 6-digit code to <strong className="text-cyan-300">{email}</strong>.
                      </p>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                      <div>
                        <input
                          type="text"
                          maxLength={6}
                          autoFocus
                          required
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="••••••"
                          className="w-full text-center tracking-[12px] font-mono text-2xl font-bold rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-cyan-400 placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>

                      {errorMsg && (
                        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading || otpCode.trim().length !== 6}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            Confirm & Go to Spin Wheel
                            <ArrowRight className="h-4 w-4" />
                          </>
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

                {/* ─── ALREADY SPUN STATE (PREVENTS DUPLICATE) ─── */}
                {step === "already_spun" && existingEntry && (
                  <div className="text-center py-2">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                      <Clock className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Already Participated!</h3>
                    <p className="mt-2 text-xs text-slate-400">
                      Our records show that <strong className="text-slate-200">{existingEntry.email}</strong> has already spun the wheel. Each verified participant is entitled to 1 spin.
                    </p>

                    <div className="my-5 rounded-xl border border-cyan-500/30 bg-slate-900/80 p-4 text-left">
                      <div className="text-[11px] uppercase tracking-wider text-cyan-400 font-semibold">
                        Your Won Reward:
                      </div>
                      <div className="mt-1 text-lg font-bold text-white">
                        {existingEntry.rewardTitle}
                      </div>
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 border border-slate-800">
                        <span className="font-mono text-sm text-cyan-300 font-bold">
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
                      <div className="mt-2 text-[11px] text-slate-400">
                        Status: <span className="capitalize text-slate-200">{existingEntry.status}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClose}
                      className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                    >
                      Continue to Website
                    </button>
                  </div>
                )}

                {/* ─── STEP 3: THE SPIN WHEEL ─── */}
                {step === "wheel" && (
                  <div className="text-center">
                    <div className="mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Verified: {email}
                      </span>
                      <h3 className="text-xl font-black text-white sm:text-2xl">
                        Tap To Spin The Wheel!
                      </h3>
                    </div>

                    {/* Interactive Canvas Wheel */}
                    <div className="my-2 flex justify-center">
                      <SpinWheelCanvas
                        size={320}
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
                      className="w-full rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 py-3.5 text-base font-black text-white shadow-xl shadow-rose-500/30 transition hover:opacity-95 disabled:opacity-50"
                    >
                      {isSpinning ? "SPINNING THE WHEEL..." : "★ SPIN THE WHEEL NOW ★"}
                    </button>
                  </div>
                )}

                {/* ─── STEP 4: REWARD WON POPUP (OFFER WITH CLAIM & REJECT BUTTONS) ─── */}
                {step === "won_modal" && wonReward && (
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 ring-4 ring-cyan-500/10">
                      <Sparkles className="h-8 w-8 animate-pulse" />
                    </div>

                    <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-400">
                      Congratulations {name || "Winner"}!
                    </span>
                    <h3 className="mt-1 text-2xl font-black text-white sm:text-3xl">
                      {wonReward.claimHeadline}
                    </h3>
                    <p className="mt-1 text-xs text-slate-300">
                      {wonReward.claimSubtitle}
                    </p>

                    {/* Voucher Card */}
                    <div className="my-5 rounded-xl border border-cyan-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-4 text-center shadow-lg">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Your Unique Voucher Code
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-3">
                        <span className="font-mono text-2xl font-black tracking-wider text-cyan-300">
                          {voucherCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="rounded-md bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
                          title="Copy Code"
                        >
                          {copiedCode ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400">{wonReward.terms}</p>
                    </div>

                    {/* TWO EXPLICIT BUTTONS REQUESTED BY USER:
                        1. Form fill to claim offer
                        2. Reject / decline button */}
                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={handleProceedToClaim}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
                      >
                        Claim Offer & Fill Details
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleRejectOffer}
                        className="w-full rounded-lg border border-slate-700 bg-transparent py-2.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                      >
                        No Thanks, Return to Landing Page
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── STEP 5: CLAIM REGISTRATION FORM ─── */}
                {step === "claim_form" && wonReward && (
                  <div>
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-white">Activate Your Reward</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Claiming: <strong className="text-cyan-300">{wonReward.title}</strong> ({voucherCode})
                      </p>
                    </div>

                    <form onSubmit={handleSubmitClaim} className="mt-5 space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
                          Name
                        </label>
                        <input
                          type="text"
                          disabled
                          value={name}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
                          Verified Email
                        </label>
                        <input
                          type="email"
                          disabled
                          value={email}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                          WhatsApp / Mobile Number *
                        </label>
                        <div className="relative mt-1">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                          <input
                            type="tel"
                            required
                            placeholder="e.g. 9876543210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 pl-9 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                          College / University / Company (Optional)
                        </label>
                        <div className="relative mt-1">
                          <School className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                          <input
                            type="text"
                            placeholder="e.g. IIT Bombay, Delhi University"
                            value={college}
                            onChange={(e) => setCollege(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 pl-9 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                          What project or goal interests you most? (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bioinformatics, AI Drug Discovery, Mentorship"
                          value={claimNotes}
                          onChange={(e) => setClaimNotes(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>

                      {errorMsg && (
                        <div className="text-xs text-rose-400">{errorMsg}</div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Submitting Claim...
                          </>
                        ) : (
                          "Confirm & Submit Claim"
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* ─── STEP 6: CLAIM SUCCESS CONFIRMATION ─── */}
                {step === "claimed_success" && (
                  <div className="text-center py-4">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-black text-white">Reward Successfully Claimed!</h3>
                    <p className="mt-2 text-xs text-slate-300">
                      Your voucher <strong className="text-cyan-300">{voucherCode}</strong> has been registered for <strong className="text-white">{wonReward?.title}</strong>.
                    </p>

                    <div className="my-6 space-y-3">
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
                      >
                        Connect on WhatsApp to Redeem Now
                        <ExternalLink className="h-4 w-4" />
                      </a>

                      <button
                        type="button"
                        onClick={handleClose}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                      >
                        Close & Explore Website
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

