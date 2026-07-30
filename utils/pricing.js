// Single source of truth for plan pricing and discount math.
//
// Discounts are stored as PERCENTAGES and are always applied to the amount the
// buyer actually owes, not to the plan's sticker price. That distinction matters:
// a referrer buying for their referral only remits (price - their commission), so
// applying a percentage to the sticker price could exceed what they owe and push
// the total negative. Percent-of-payable can never go below $0.
//
// Commissions are always calculated from the FULL plan price and are never
// reduced by a discount - a referrer's income is unaffected by discounting.

const PLAN_PRICING = {
  knowic: { price: 24, direct: 16, passive: 2 },
  learnic: { price: 59, direct: 40, passive: 4 },
  masteric: { price: 130, direct: 85, passive: 7 },
};

// Maps a plan to its percentage field on the Discount settings document
const PERCENT_FIELD = {
  knowic: 'knowicPercent',
  learnic: 'learnicPercent',
  masteric: 'mastericPercent',
};

// Money is rounded to 2 decimal places
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * The amount a buyer owes before any discount.
 * - Self purchase: the full plan price.
 * - Referrer buying for their referral: plan price minus the direct commission
 *   they keep, since they collect full price from the referral offline.
 */
const getBaseAmount = (plan, isSelfPurchase) => {
  const pricing = PLAN_PRICING[plan];
  if (!pricing) return 0;
  return isSelfPurchase ? pricing.price : round2(pricing.price - pricing.direct);
};

/**
 * Live discount percentage for a plan, clamped to 0-100.
 * Returns 0 when discounts are globally disabled or unset.
 */
const getDiscountPercent = (discountDoc, plan) => {
  if (!discountDoc || !discountDoc.enabled) return 0;
  const percent = Number(discountDoc[PERCENT_FIELD[plan]]) || 0;
  return Math.min(100, Math.max(0, percent));
};

/**
 * Authoritative quote for a purchase. Always derived from the live discount
 * settings, never from client-supplied amounts.
 *
 * @returns {{percent, baseAmount, discountAmount, finalPrice, originalPrice, applied}}
 */
const quoteDiscount = ({ discountDoc, plan, isSelfPurchase, useDiscount = true }) => {
  const pricing = PLAN_PRICING[plan];
  const baseAmount = getBaseAmount(plan, isSelfPurchase);
  const percent = useDiscount ? getDiscountPercent(discountDoc, plan) : 0;
  const discountAmount = round2(baseAmount * (percent / 100));

  return {
    percent,
    baseAmount,
    discountAmount,
    // percent is clamped to <= 100, so this is always >= 0
    finalPrice: round2(baseAmount - discountAmount),
    originalPrice: pricing ? pricing.price : 0,
    applied: percent > 0,
  };
};

module.exports = {
  PLAN_PRICING,
  PERCENT_FIELD,
  round2,
  getBaseAmount,
  getDiscountPercent,
  quoteDiscount,
};
