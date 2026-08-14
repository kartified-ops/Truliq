const express = require('express');
const router = express.Router();
const WorkerSubscriptionPlan = require('../../models/WorkerSubscriptionPlan');
const Worker = require('../../models/Worker');
const { authenticate } = require('../../middleware/authMiddleware');
const { isWorker } = require('../../middleware/roleMiddleware');
const { createSubscriptionOrder, verifySubscriptionPayment } = require('../../controllers/paymentControllers/subscriptionPaymentController');

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
 * Get current worker's subscription status
 */
/**
 * GET /api/workers/subscription/status
 * Get current worker's subscription status
 */
router.get('/status', authenticate, isWorker, async (req, res) => {
  try {
    const worker = await Worker.findById(req.user.id)
      .select('subscription wallet')
      .populate('subscription.planId')
      .lean();

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const sub = worker.subscription || {};
    const plan = sub.planId && typeof sub.planId === 'object' ? sub.planId : null;

    const isActive = !!(sub.isActive && sub.expiryDate && new Date(sub.expiryDate) > new Date());

    let amountPaid = sub.amountPaid;
    let paymentDate = sub.paymentDate || sub.startDate;
    let planName = sub.planName || (plan ? plan.title : null);
    let durationDays = sub.durationDays || (plan ? plan.durationDays : null);

    // If amountPaid is missing, try looking up from latest worker_subscription transaction or plan
    if ((amountPaid === undefined || amountPaid === null) && (isActive || sub.expiryDate)) {
      try {
        const Transaction = require('../../models/Transaction');
        const latestTx = await Transaction.findOne({
          workerId: req.user.id,
          type: 'worker_subscription'
        }).sort({ createdAt: -1 }).lean();

        if (latestTx) {
          amountPaid = latestTx.amount;
          paymentDate = paymentDate || latestTx.createdAt;
        } else if (plan) {
          amountPaid = plan.price;
        }
      } catch (e) {
        if (plan) amountPaid = plan.price;
      }
    }

    // Determine normalized plan display name:
    // - Admin-granted free access / ₹0 plan / trial plan -> "Free Plan"
    // - Worker purchased subscription -> actual purchased plan name
    // - No active plan -> "No Active Plan"
    let displayPlanName = 'No Active Plan';
    let isFreePlan = false;

    if (isActive) {
      const rawName = (planName || '').toLowerCase();
      const isPaid = amountPaid !== undefined && amountPaid !== null && amountPaid > 0;
      
      if (!isPaid || rawName.includes('free') || rawName.includes('trial')) {
        displayPlanName = 'Free Plan';
        isFreePlan = true;
      } else {
        displayPlanName = planName || (plan ? plan.title : 'Paid Plan');
        isFreePlan = false;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        isActive,
        expiryDate: sub.expiryDate || null,
        startDate: sub.startDate || null,
        planName: displayPlanName,
        rawPlanName: planName,
        isFreePlan,
        durationDays,
        amountPaid: amountPaid !== undefined && amountPaid !== null ? amountPaid : 0,
        paymentDate: paymentDate || null,
        walletBalance: worker.wallet?.balance || 0
      }
    });
  } catch (error) {
    console.error('[Subscription Routes] Status error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

/**
 * POST /api/workers/subscription/activate
 * Admin can manually activate a plan for a worker (or after Razorpay webhook)
 */
router.post('/activate', authenticate, isWorker, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = await WorkerSubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }

    const worker = await Worker.findById(req.user.id);
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const now = new Date();
    const isSubActive = !!(worker.subscription?.isActive && worker.subscription?.expiryDate && new Date(worker.subscription.expiryDate) > now);
    if (isSubActive && plan.allowExtension === false) {
      return res.status(400).json({ success: false, message: 'This plan cannot be used to extend an active subscription' });
    }
    // If subscription still active, extend from current expiry; else from now
    const baseDate = (worker.subscription?.isActive && worker.subscription?.expiryDate &&
      new Date(worker.subscription.expiryDate) > now)
      ? new Date(worker.subscription.expiryDate)
      : now;

    const expiryDate = new Date(baseDate);
    expiryDate.setDate(expiryDate.getDate() + plan.durationDays);

    worker.subscription = {
      isActive: true,
      planId: plan._id,
      planName: plan.title,
      startDate: now,
      expiryDate,
      durationDays: plan.durationDays,
      amountPaid: plan.price,
      paymentDate: now
    };

    await worker.save();

    res.status(200).json({
      success: true,
      message: `Subscription activated! Valid until ${expiryDate.toLocaleDateString('en-IN')}`,
      data: {
        planName: plan.title,
        expiryDate,
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
