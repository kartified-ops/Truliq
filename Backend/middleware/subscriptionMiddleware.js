const Worker = require('../models/Worker');
const {
  isSubscriptionCurrentlyActive,
  expireSubscriptionIfNeeded,
  getSubscriptionStatusValue,
  SUBSCRIPTION_STATUS
} = require('../utils/workerSubscriptionUtil');

const expiredResponse = (sub) => {
  const isTrial = sub?.planType === 'TRIAL';
  return {
    success: false,
    code: 'SUBSCRIPTION_EXPIRED',
    message: isTrial
      ? 'Your free subscription has expired. Please upgrade to a paid plan to continue.'
      : 'Your subscription has expired. Please upgrade your plan.'
  };
};

const requiredResponse = () => ({
  success: false,
  code: 'SUBSCRIPTION_REQUIRED',
  message: 'You need an active subscription to access this feature. Please upgrade your plan.'
});

/**
 * Require an authenticated worker with a currently ACTIVE, non-expired subscription.
 * Stored expiryDate is authoritative — never recomputed from Admin trial settings.
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }

    const worker = await Worker.findById(req.user.id).select('subscription trialUsed');
    if (!worker) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please login again.'
      });
    }

    const now = new Date();
    if (expireSubscriptionIfNeeded(worker, now)) {
      await worker.save();
    }

    const sub = worker.subscription || {};
    const status = getSubscriptionStatusValue(sub, now);

    if (status === SUBSCRIPTION_STATUS.EXPIRED) {
      return res.status(403).json(expiredResponse(sub));
    }

    if (!isSubscriptionCurrentlyActive(sub, now)) {
      return res.status(403).json(requiredResponse());
    }

    req.workerSubscription = sub;
    next();
  } catch (error) {
    console.error('[SubscriptionMiddleware] error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify subscription. Please try again.'
    });
  }
};

module.exports = {
  requireActiveSubscription
};
