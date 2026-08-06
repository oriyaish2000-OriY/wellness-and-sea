/**
 * WELLNESS&SEA — Commission calculations
 *
 * Arithmetic is performed in AGOROT (integer) to eliminate floating-point errors.
 * 100 agorot = 1 ILS.
 *
 * Platform model: we are an intermediary. We do NOT hold public funds.
 * We invoice only our commission; the remainder is routed directly to
 * the beneficiary (host or instructor) via split payment.
 *
 * ─── Flow 1: Space Rental (Instructor → Host) ────────────────────────────────
 *   basePrice       = venue hourly rate × hours  (the "fair" price)
 *   instructorPays  = base × 1.05  (5% markup added to instructor)
 *   hostPayout      = base × 0.95  (5% deducted from host)
 *   platformRevenue = 5% + 5% = 10% of base
 *
 * ─── Flow 2: Class Booking (Student → Instructor) ────────────────────────────
 *   basePrice         = price set by instructor (the "fair" price)
 *   studentPays       = base × 1.05  (5% markup added to student)
 *   instructorPayout  = base × 0.95  (5% deducted from instructor)
 *   platformRevenue   = 5% + 5% = 10% of base
 *   → Both parties share the 10% commission equally (5% each).
 */

// ─── Basis points ─────────────────────────────────────────────────────────────
const MARKUP_BPS    = 500    // 5 % charged to the paying party
const DEDUCTION_BPS = 500    // 5 % deducted from the receiving party
const BPS_BASE      = 10_000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpaceRentalSplit {
  /** Base price (venue rate) — what was negotiated, ILS */
  basePrice:             number
  /** What the instructor is charged (base + 5%), ILS */
  instructorPays:        number
  /** What the host receives (base − 5%), ILS */
  hostPayout:            number
  /** Platform gross revenue (markup + deduction = 10% of base), ILS */
  platformRevenue:       number

  // Agorot integers — pass directly to payment gateway
  instructorPaysAgorot:  number
  hostPayoutAgorot:      number
  platformRevenueAgorot: number
}

export interface ClassBookingSplit {
  /** Base price set by the instructor, ILS */
  basePrice:              number
  /** What the student is charged (base + 5%), ILS */
  studentPays:            number
  /** What the instructor receives (base − 5%), ILS */
  instructorPayout:       number
  /** Platform gross revenue (10% of base), ILS */
  platformRevenue:        number

  // Agorot integers — pass directly to payment gateway
  studentPaysAgorot:      number
  instructorPayoutAgorot: number
  platformRevenueAgorot:  number
}

// ─── Flow 1: Space Rental ─────────────────────────────────────────────────────

/**
 * @param basePriceILS - Negotiated venue price (hourly_rate × hours)
 */
export function calcSpaceRentalSplit(basePriceILS: number): SpaceRentalSplit {
  if (basePriceILS <= 0) throw new Error('basePriceILS must be positive')

  const baseAgorot = Math.round(basePriceILS * 100)

  // Instructor pays base + 5% (ceil — platform never loses an agora)
  const markupAgorot        = Math.ceil(baseAgorot * MARKUP_BPS / BPS_BASE)
  const instructorPaysAgorot = baseAgorot + markupAgorot

  // Host receives base − 5% (floor — platform never overpays)
  const deductionAgorot  = Math.floor(baseAgorot * DEDUCTION_BPS / BPS_BASE)
  const hostPayoutAgorot = baseAgorot - deductionAgorot

  const platformRevenueAgorot = instructorPaysAgorot - hostPayoutAgorot

  return {
    basePrice:             basePriceILS,
    instructorPays:        instructorPaysAgorot  / 100,
    hostPayout:            hostPayoutAgorot      / 100,
    platformRevenue:       platformRevenueAgorot / 100,
    instructorPaysAgorot,
    hostPayoutAgorot,
    platformRevenueAgorot,
  }
}

// ─── Flow 2: Class Booking ────────────────────────────────────────────────────

/**
 * @param basePriceILS - Price set by the instructor per student
 *
 * Student  pays base × 1.05 → they feel a 5% service fee
 * Instructor gets base × 0.95 → 5% deducted from their payout
 * Platform earns base × 0.10 → 10% total (5% from each side)
 */
export function calcClassBookingSplit(basePriceILS: number): ClassBookingSplit {
  if (basePriceILS <= 0) throw new Error('basePriceILS must be positive')

  const baseAgorot = Math.round(basePriceILS * 100)

  // Student pays base + 5% markup (ceil)
  const studentMarkupAgorot = Math.ceil(baseAgorot * MARKUP_BPS / BPS_BASE)
  const studentPaysAgorot   = baseAgorot + studentMarkupAgorot

  // Instructor receives base − 5% deduction (floor)
  const instructorDeductionAgorot = Math.floor(baseAgorot * DEDUCTION_BPS / BPS_BASE)
  const instructorPayoutAgorot    = baseAgorot - instructorDeductionAgorot

  // Platform earns the spread (= 10% of base ±1 agora from rounding)
  const platformRevenueAgorot = studentPaysAgorot - instructorPayoutAgorot

  return {
    basePrice:              basePriceILS,
    studentPays:            studentPaysAgorot      / 100,
    instructorPayout:       instructorPayoutAgorot / 100,
    platformRevenue:        platformRevenueAgorot  / 100,
    studentPaysAgorot,
    instructorPayoutAgorot,
    platformRevenueAgorot,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function ilsToAgorot(ils: number): number {
  return Math.round(ils * 100)
}

export function agorotToILS(agorot: number): string {
  return (agorot / 100).toFixed(2)
}

/** Format ILS for display (e.g. "₪210.00") */
export function formatILS(ils: number): string {
  return `₪${ils.toFixed(2)}`
}
