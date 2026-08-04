/**
 * WELLNESS&SEA — Commission calculations
 *
 * All arithmetic is performed in AGOROT (integer) to eliminate floating-point
 * errors.  100 agorot = 1 ILS.
 *
 * Flow 1 — Space Rental (Instructor → Space Owner)
 *   Instructor pays:  base_price + 5%   (markup added on top)
 *   Host receives:    base_price − 5%   (deducted from base)
 *   Platform earns:   10% of base_price (markup + deduction)
 *
 * Flow 2 — Class Booking (Student → Instructor)
 *   Student pays:     price_per_student (no markup — displayed price IS total)
 *   Instructor gets:  90% of price_per_student
 *   Platform earns:   10% of price_per_student
 */

// Basis points: 1 BPS = 0.01%
const INSTRUCTOR_MARKUP_BPS = 500   // 5 %
const HOST_DEDUCTION_BPS    = 500   // 5 %
const CLASS_COMMISSION_BPS  = 1000  // 10 %
const BPS_BASE              = 10_000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpaceRentalSplit {
  /** What the instructor is charged (ILS). Stored as booking.total_price */
  instructorPays:     number
  /** What the host receives (ILS). Stored as booking.host_payout */
  hostPayout:         number
  /** Platform gross revenue (ILS). Stored as booking.platform_fee */
  platformRevenue:    number

  // Agorot versions — send directly to Grow API
  instructorPaysAgorot:  number
  hostPayoutAgorot:      number
  platformRevenueAgorot: number
}

export interface ClassBookingSplit {
  /** What the student pays (ILS). Equals price_per_student — no markup */
  studentPays:       number
  /** What the instructor receives (ILS) */
  instructorPayout:  number
  /** Platform commission (ILS) */
  platformRevenue:   number

  // Agorot versions — send directly to Grow API
  studentPaysAgorot:      number
  instructorPayoutAgorot: number
  platformRevenueAgorot:  number
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

/**
 * Calculate the three-way split for a space-rental booking.
 *
 * @param basePriceILS - The venue's hourly_price × hours (the "before commission" amount)
 */
export function calcSpaceRentalSplit(basePriceILS: number): SpaceRentalSplit {
  if (basePriceILS <= 0) throw new Error('basePriceILS must be positive')

  const baseAgorot = Math.round(basePriceILS * 100)

  // Instructor pays base + 5%. Ceil so the platform never loses a single agora.
  const markupAgorot        = Math.ceil(baseAgorot * INSTRUCTOR_MARKUP_BPS / BPS_BASE)
  const instructorPaysAgorot = baseAgorot + markupAgorot

  // Host receives base − 5%. Floor so we never overpay the host.
  const deductionAgorot  = Math.floor(baseAgorot * HOST_DEDUCTION_BPS / BPS_BASE)
  const hostPayoutAgorot = baseAgorot - deductionAgorot

  // Platform gets the difference: exactly markup + deduction
  const platformRevenueAgorot = instructorPaysAgorot - hostPayoutAgorot

  return {
    instructorPays:     instructorPaysAgorot  / 100,
    hostPayout:         hostPayoutAgorot      / 100,
    platformRevenue:    platformRevenueAgorot / 100,
    instructorPaysAgorot,
    hostPayoutAgorot,
    platformRevenueAgorot,
  }
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

/**
 * Calculate the two-way split for a student enrolling in an instructor's class.
 *
 * @param pricePerStudentILS - The price shown to the student (displayed price = charged price)
 */
export function calcClassBookingSplit(pricePerStudentILS: number): ClassBookingSplit {
  if (pricePerStudentILS <= 0) throw new Error('pricePerStudentILS must be positive')

  const studentPaysAgorot = Math.round(pricePerStudentILS * 100)

  // Platform takes 10%. Ceil so the platform never loses a single agora.
  const platformRevenueAgorot  = Math.ceil(studentPaysAgorot * CLASS_COMMISSION_BPS / BPS_BASE)
  const instructorPayoutAgorot = studentPaysAgorot - platformRevenueAgorot

  return {
    studentPays:       studentPaysAgorot      / 100,
    instructorPayout:  instructorPayoutAgorot / 100,
    platformRevenue:   platformRevenueAgorot  / 100,
    studentPaysAgorot,
    instructorPayoutAgorot,
    platformRevenueAgorot,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert an ILS float to an integer agorot value (safe rounding) */
export function ilsToAgorot(ils: number): number {
  return Math.round(ils * 100)
}

/** Convert agorot integer to ILS string formatted for display */
export function agorotToILS(agorot: number): string {
  return (agorot / 100).toFixed(2)
}
