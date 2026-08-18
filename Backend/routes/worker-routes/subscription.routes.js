const express = require('express');
const router = express.Router();
const WorkerSubscriptionPlan = require('../../models/WorkerSubscriptionPlan');
const Worker = require('../../models/Worker');
const { authenticate } = require('../../middleware/authMiddleware');
const { isWorker } = require('../../middleware/roleMiddleware');
const { createSubscriptionOrder, verifySubscriptionPayment } = require('../../controllers/paymentControllers/subscriptionPaymentController');
const { grantFreeTrialIfEligible } = require('../../services/workerFreeTrialService');
const {
  isSubscriptionCurrentlyActive,
  expireSubscriptionIfNeeded,
  getSubscriptionStatusValue,
  applyPaidSubscription,
  PLAN_TYPES,
  SUBSCRIPTION_STATUS
} = require('../../utils/workerSubscriptionUtil');

const formatStatusPayload = (worker, now = new Date()) => {
  const sub = worker.subscription || {};
  const plan = sub.planId && typeof sub.planId === 'object' ? sub.planId : null;
  const status = getSubscriptionStatusValue(sub, now);
  const isActive = isSubscriptionCurrentlyActive(sub, now);
  const planType = sub.planType || (isActive && (sub.amountPaid === 0 || (sub.planName || '').toLowerCase().includes('trial')) ? PLAN_TYPES.TRIAL : (isActive ? PLAN_TYPES.PAID : null));
  const isTrial = planType === PLAN_TYPES.TRIAL;
  const trialUsed = !!(worker.trialUsed || sub.trialUsed);

  let amountPaid = sub.amountPaid;
  if (amountPaid === undefined || amountPaid === null) {
    amountPaid = isTrial ? 0 : null;
  }

  const planName = isActive
    ? (isTrial ? 'FREE SUBSCRIPTION' : (sub.planName || (plan ? plan.title : 'Paid Plan')))
    : (status === SUBSCRIPTION_STATUS.EXPIRED
      ? (isTrial || (sub.planName || '').toLowerCase().includes('trial') ? 'FREE SUBSCRIPTION' : (sub.planName || 'Subscription'))
      : 'No Active Plan');

  let expiredMessage = null;
  if (status === SUBSCRIPTION_STATUS.EXPIRED) {
    expiredMessage = (isTrial || trialUsed && !sub.amountPaid)
      ? 'Your free subscription has expired. Please upgrade to a paid plan to continue.'
      : 'Your subscription has expired. Please upgrade your plan.';
  }

  return {
    isActive,
    status,
    planType: planType || null,
    planName,
    rawPlanName: sub.planName || (plan ? plan.title : null),
    isFreePlan: isTrial && isActive,
    isTrial: isTrial && isActive,
    trialUsed,
    trialDuration: sub.trialDuration || null,
    trialDurationUnit: sub.trialDurationUnit || null,
    startDate: sub.startDate || null,
    expiryDate: sub.expiryDate || null,
    endDate: sub.expiryDate || null,
    durationDays: sub.durationDays || (plan ? plan.durationDays : null),
    amountPaid: amountPaid !== undefined && amountPaid !== null ? amountPaid : 0,
    paymentDate: sub.paymentDate || (isTrial ? null : sub.startDate) || null,
    expiredMessage,
    walletBalance: worker.wallet?.balance || 0
  };
};

// POST /api/workers/subscription/create-order → Create Razorpay order
router.post('/create-order', authenticate, isWorker, createSubscriptionOrder);

// POST /api/workers/subscription/verify-payment → Verify & activate
router.post('/verify-payment', authenticate, isWorker, verifySubscriptionPayment);

/**
 * GET /api/workers/subscription/plans
 * Fetch all active subscription plans (for workers to browse & buy)
 */
router.get('/plans', authenticate, isWorker, async (req, res) => {
  try {
    const plans = await WorkerSubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

/**
 * GET /api/workers/subscription/status
 * Get current worker's subscription status.
 * Stored expiryDate is authoritative — expired trials are persisted as EXPIRED.
 */
router.get('/status', authenticate, isWorker, async (req, res) => {
  try {
    const worker = await Worker.findById(req.user.id)
      .select('subscription wallet trialUsed phone')
      .populate('subscription.planId');

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const now = new Date();
    if (expireSubscriptionIfNeeded(worker, now)) {
      await worker.save();
    }

    // Existing workers who never received a FREE trial get it when Admin has it enabled.
    if (!isSubscriptionCurrentlyActive(worker.subscription, now)) {
      try {
        await grantFreeTrialIfEligible(worker);
      } catch (trialError) {
        console.error('[Subscription] FREE trial grant on status failed:', trialError);
      }
    }

    const payload = formatStatusPayload(worker.toObject ? worker.toObject() : worker, now);

    if ((payload.amountPaid === undefined || payload.amountPaid === null) && (payload.isActive || payload.expiryDate)) {
      try {
        const Transaction = require('../../models/Transaction');
        const latestTx = await Transaction.findOne({
          workerId: req.user.id,
          type: 'worker_subscription'
        }).sort({ createdAt: -1 }).lean();

        if (latestTx) {
          payload.amountPaid = latestTx.amount;
          payload.paymentDate = payload.paymentDate || latestTx.createdAt;
        }
      } catch (e) {
        // keep existing amountPaid
      }
    }

    res.status(200).json({
      success: true,
      data: payload
    });
  } catch (error) {
    console.error('[Subscription Routes] Status error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

/**
 * POST /api/workers/subscription/activate
 * Activate a paid plan for a worker (legacy / admin-assisted path).
 * Zero-price plans cannot be used to mint a second FREE trial.
 */
router.post('/activate', authenticate, isWorker, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await WorkerSubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }

    if (!plan.price || plan.price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Free plans cannot be activated manually. FREE trial is granted automatically on first registration.'
      });
    }

    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const now = new Date();
    expireSubscriptionIfNeeded(worker, now);
    const isSubActive = isSubscriptionCurrentlyActive(worker.subscription, now);
    if (isSubActive && plan.allowExtension === false) {
      return res.status(400).json({ success: false, message: 'This plan cannot be used to extend an active subscription' });
    }
    const baseDate = isSubActive && worker.subscription?.expiryDate
      ? new Date(worker.subscription.expiryDate)
      : now;

    const expiryDate = new Date(baseDate);
    expiryDate.setDate(expiryDate.getDate() + plan.durationDays);

    applyPaidSubscription(worker, {
      plan,
      expiryDate,
      now,
      amountPaid: plan.price,
      paymentId: null,
      orderId: null
    });

    await worker.save();

    const { markPhoneAsPaid } = require('../../services/workerFreeTrialService');
    markPhoneAsPaid(worker.phone, worker._id).catch((err) => {
      console.error('[Subscription] markPhoneAsPaid failed:', err);
    });

    res.status(200).json({
      success: true,
      message: `Subscription activated! Valid until ${expiryDate.toLocaleDateString('en-IN')}`,
      data: {
        planName: plan.title,
        planType: PLAN_TYPES.PAID,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        expiryDate,
        endDate: expiryDate,
        durationDays: plan.durationDays,
        amountPaid: plan.price,
        paymentDate: now
      }
    });
  } catch (error) {
    console.error('[Subscription] Activate error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
