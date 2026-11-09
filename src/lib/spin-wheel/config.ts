import type { SpinReward } from "./types";

/**
 * 6 Defined Spin Wheel Rewards with exact probability distribution summing to 100%.
 */
export const SPIN_REWARDS: SpinReward[] = [
  {
    id: "discount-25",
    title: "25% Discount",
    shortLabel: "25% OFF",
    probability: 25,
    color: "#0891b2", // Cyan 600
    textColor: "#ffffff",
    iconName: "Percent",
    description: "Get 25% off on any certified research program or workshop.",
    claimHeadline: "25% Discount Voucher Unlocked!",
    claimSubtitle: "Valid on BioPlastic Innovation, AI in Drug Discovery, and Bioinformatics.",
    terms: "Valid for 14 days from date of issue. Applicable to any single enrollment.",
  },
  {
    id: "discount-50",
    title: "50% Discount",
    shortLabel: "50% OFF",
    probability: 20,
    color: "#4f46e5", // Indigo 600
    textColor: "#ffffff",
    iconName: "Tag",
    description: "Enjoy a massive 50% discount on any flagship 30-day research internship.",
    claimHeadline: "Huge 50% Off Research Internship Voucher!",
    claimSubtitle: "Double your savings on professional certified programs.",
    terms: "Valid for 14 days. Non-transferable, single-use voucher.",
  },
  {
    id: "free-mentorship",
    title: "FREE Mentorship Session",
    shortLabel: "FREE MENTOR",
    probability: 20,
    color: "#059669", // Emerald 600
    textColor: "#ffffff",
    iconName: "GraduationCap",
    description: "1-on-1 personalized academic and research career mentoring with senior scientists.",
    claimHeadline: "Free 1-on-1 Mentorship Session!",
    claimSubtitle: "Get direct career direction, resume review, and project guidance.",
    terms: "Scheduled via calendar link within 30 days of redemption.",
  },
  {
    id: "live-call-founder",
    title: "Live Call with the Founder",
    shortLabel: "FOUNDER CALL",
    probability: 20,
    color: "#d97706", // Amber 600
    textColor: "#ffffff",
    iconName: "PhoneCall",
    description: "Exclusive 30-minute private call with the Founder of Micrylis Biotech.",
    claimHeadline: "Private 1-on-1 Session with the Founder!",
    claimSubtitle: "Discuss startup ideas, research career paths, or collaborative opportunities.",
    terms: "Strictly limited to 1 call per verified participant.",
  },
  {
    id: "ielts-interview",
    title: "Free IELTS Interview Session",
    shortLabel: "IELTS MOCK",
    probability: 14,
    color: "#7c3aed", // Violet 600
    textColor: "#ffffff",
    iconName: "Award",
    description: "Full speaking mock interview and diagnostic feedback with an IELTS specialist.",
    claimHeadline: "Free IELTS Speaking Diagnostic & Mock!",
    claimSubtitle: "Prepare for global university and lab admissions with expert feedback.",
    terms: "Valid for one comprehensive 45-minute live mock session.",
  },
  {
    id: "free-full-project",
    title: "Free Full Project (Any)",
    shortLabel: "FREE PROJECT",
    probability: 1,
    color: "#e11d48", // Rose/Ruby 600 (Jackpot!)
    textColor: "#ffffff",
    iconName: "Sparkles",
    description: "Grand Prize! 100% scholarship for any full 30-day intensive research project of your choice.",
    claimHeadline: "🎉 JACKPOT! 100% Free Research Project!",
    claimSubtitle: "Zero fees. Full mentoring, datasets, computing, and verified certification included.",
    terms: "Grand prize winner must redeem within 21 days. Full verification required.",
  },
];

/**
 * Offer Expiry Date: 20 November 2026, 23:59:59 IST
 */
export const SPIN_WHEEL_EXPIRY_DATE = new Date("2026-11-20T23:59:59+05:30");
export const SPIN_EXPIRY_LABEL = "20 November 2026";

/**
 * Returns true if the promotional spin offer has passed 20 November 2026.
 */
export function isSpinOfferExpired(): boolean {
  return Date.now() > SPIN_WHEEL_EXPIRY_DATE.getTime();
}

/**
 * Calculates remaining days/hours until expiry
 */
export function getExpiryCountdown(): {
  days: number;
  hours: number;
  isExpired: boolean;
} {
  const diff = SPIN_WHEEL_EXPIRY_DATE.getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, isExpired: true };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  return { days, hours, isExpired: false };
}

/** Total slices count */
export const SLICES_COUNT = SPIN_REWARDS.length; // 6
export const SLICE_ANGLE = 360 / SLICES_COUNT; // 60 degrees each


/**
 * Weighted Random Selection based on the exact probabilities (1..100).
 * Probability breakdown:
 * 1-25   (25%) -> discount-25 (index 0)
 * 26-45  (20%) -> discount-50 (index 1)
 * 46-65  (20%) -> free-mentorship (index 2)
 * 66-85  (20%) -> live-call-founder (index 3)
 * 86-99  (14%) -> ielts-interview (index 4)
 * 100    (1%)  -> free-full-project (index 5)
 */
export function selectRewardByProbability(rollOutOf100: number): {
  reward: SpinReward;
  index: number;
} {
  // Clamp roll between 1 and 100
  const roll = Math.max(1, Math.min(100, Math.round(rollOutOf100)));

  let cumulative = 0;
  for (let i = 0; i < SPIN_REWARDS.length; i++) {
    cumulative += SPIN_REWARDS[i].probability;
    if (roll <= cumulative) {
      return { reward: SPIN_REWARDS[i], index: i };
    }
  }

  // Fallback to first reward
  return { reward: SPIN_REWARDS[0], index: 0 };
}

/**
 * Generates a unique, memorable voucher code like `MCR-DISC-7K9P`
 */
export function generateVoucherCode(rewardId: string): string {
  const prefixMap: Record<string, string> = {
    "discount-25": "MCR-D25",
    "discount-50": "MCR-D50",
    "free-mentorship": "MCR-MENTOR",
    "live-call-founder": "MCR-FOUNDER",
    "ielts-interview": "MCR-IELTS",
    "free-full-project": "MCR-JACKPOT",
  };
  const prefix = prefixMap[rewardId] || "MCR-PRIZE";
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${randomChars}`;
}

