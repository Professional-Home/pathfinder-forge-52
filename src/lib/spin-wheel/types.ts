export type RewardStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "REDEEMED" | "EXPIRED";
export type FormStatus = "NOT_APPLICABLE" | "FORM_PENDING" | "FORM_SUBMITTED" | "FORM_VERIFIED";

export interface SpinReward {
  id: string;
  title: string;
  shortLabel: string;
  probability: number; // percentage (e.g. 25, 20, 14, 1)
  color: string;
  textColor: string;
  iconName: string;
  description: string;
  claimHeadline: string;
  claimSubtitle: string;
  terms: string;
}

export interface SpinWheelEntry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  college?: string;
  rewardId: string;
  rewardTitle: string;
  voucherCode: string;
  probabilityPct: number;
  status: "won" | "claimed" | "rejected";
  rewardStatus?: RewardStatus;
  formStatus?: FormStatus;
  formUrl?: string;
  formOpenedAt?: string;
  formSubmittedAt?: string;
  formVerifiedAt?: string;
  formResponseId?: string;
  isClaimed: boolean;
  claimedAt?: string;
  claimNotes?: string;
  redeemedAt?: string;
  redeemedByAdmin?: string;
  redemptionNotes?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface SpinVerificationState {
  step: "form" | "otp" | "already_spun" | "wheel" | "won_modal" | "claim_form" | "completed";
  name: string;
  email: string;
  otpCode: string;
  isVerifying: boolean;
  isSendingOtp: boolean;
  error?: string;
  resendCooldown: number;
}

