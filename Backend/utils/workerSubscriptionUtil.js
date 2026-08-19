const PLAN_TYPES = Object.freeze({
  TRIAL: 'TRIAL',
  PAID: 'PAID'
});

const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  NONE: 'NONE'
});

/**
 * Authoritative check: stored expiryDate is the source of truth.
 * currentDate >= endDate → expired. Never recalculate from admin config.
 */
const isSubscriptionCurrentlyActive = (sub, now = new Date()) => {
  if (!sub) return false;
  if (sub.isActive !== true && sub.status !== SUBSCRIPTION_STATUS.ACTIVE) return false;
  if (!sub.expiryDate) return false;
  return new Date(sub.expiryDate).getTime() > new Date(now).getTime();
};

const isSubscriptionExpired = (sub, now = new Date()) => {
  if (!sub || !sub.expiryDate) return false;
  return new Date(sub.expiryDate).getTime() <= new Date(now).getTime();
};

const applyExpiredStatus = (sub) => {
  if (!sub) return sub;
  sub.isActive = false;
  sub.status = SUBSCRIPTION_STATUS.EXPIRED;
  return sub;
};

/**
 * Persist ACTIVE → EXPIRED when the stored end date has passed.
 * Returns true if the document was mutated and should be saved.
 */
const expireSubscriptionIfNeeded = (worker, now = new Date()) => {
  const sub = worker?.subscription;
  if (!sub) return false;
  if (!isSubscriptionExpired(sub, now)) return false;
  if (sub.isActive !== true && sub.status !== SUBSCRIPTION_STATUS.ACTIVE) return false;
  applyExpiredStatus(sub);
  return true;
};

const getSubscriptionStatusValue = (sub, now = new Date()) => {
  if (!sub || (!sub.expiryDate && !sub.planType && !sub.planName)) {
    return SUBSCRIPTION_STATUS.NONE;
  }
  if (isSubscriptionCurrentlyActive(sub, now)) return SUBSCRIPTION_STATUS.ACTIVE;
  if (sub.expiryDate) return SUBSCRIPTION_STATUS.EXPIRED;
  return SUBSCRIPTION_STATUS.NONE;
};

const applyPaidSubscription = (worker, {
  plan,
  expiryDate,
  now,
  amountPaid,
  paymentId = null,
  orderId = null,
  transactionId = null
}) => {
  const prev = worker.subscription || {};
  const next = {
    isActive: true,
    planId: plan._id,
    planName: plan.title,
    planType: PLAN_TYPES.PAID,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    startDate: now,
    expiryDate,
    durationDays: plan.durationDays,
    amountPaid,
    paymentDate: now,
    transactionId: transactionId || paymentId || prev.transactionId || null,
    lastPaymentId: paymentId || prev.lastPaymentId || null,
    lastOrderId: orderId || prev.lastOrderId || null,
    trialUsed: !!(worker.trialUsed || prev.trialUsed),
    promotionalPauseDays: prev.promotionalPauseDays || 0
  };
  if (prev.trialDuration) next.trialDuration = prev.trialDuration;
  if (prev.trialDurationUnit) next.trialDurationUnit = prev.trialDurationUnit;
  worker.subscription = next;
  return next;
};

module.exports = {
  PLAN_TYPES,
  SUBSCRIPTION_STATUS,
  isSubscriptionCurrentlyActive,
  isSubscriptionExpired,
  applyExpiredStatus,
  expireSubscriptionIfNeeded,
  getSubscriptionStatusValue,
  applyPaidSubscription
};
