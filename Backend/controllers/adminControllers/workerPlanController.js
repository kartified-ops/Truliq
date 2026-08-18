const WorkerSubscriptionPlan = require('../../models/WorkerSubscriptionPlan');
const {
  getFreeTrialConfig,
  saveFreeTrialConfig,
  grantFreeTrialToEligibleExistingWorkers
} = require('../../services/workerFreeTrialService');
const {
  getWorkerDashboardBannerSettings,
  saveWorkerDashboardBannerSettings
} = require('../../services/workerDashboardBannerService');

/**
 * Get all worker subscription plans
 */
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await WorkerSubscriptionPlan.find().sort({ price: 1 });
    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

/**
 * Get single plan
 */
exports.getPlan = async (req, res) => {
  try {
    const plan = await WorkerSubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    res.status(200).json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * Create new plan
 */
exports.createPlan = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.duration && body.durationUnit) {
      const d = Number(body.duration);
      const unit = String(body.durationUnit).toUpperCase();
      if (unit === 'WEEK') body.durationDays = d * 7;
      else if (unit === 'MONTH') body.durationDays = d * 30;
      else if (unit === 'DAY') body.durationDays = d;
    }
    const plan = await WorkerSubscriptionPlan.create(body);
    res.status(201).json({
      success: true,
      data: plan
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update plan
 */
exports.updatePlan = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.duration && body.durationUnit) {
      const d = Number(body.duration);
      const unit = String(body.durationUnit).toUpperCase();
      if (unit === 'WEEK') body.durationDays = d * 7;
      else if (unit === 'MONTH') body.durationDays = d * 30;
      else if (unit === 'DAY') body.durationDays = d;
    }
    const plan = await WorkerSubscriptionPlan.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    res.status(200).json({
      success: true,
      data: plan
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET current FREE trial settings (single active configuration)
 */
exports.getFreeTrialSettings = async (req, res) => {
  try {
    const config = await getFreeTrialConfig();
    res.status(200).json({
      success: true,
      data: {
        enabled: config.enabled,
        duration: config.duration,
        durationUnit: config.durationUnit,
        campaignStartDate: config.campaignStartDate,
        reminderDays: config.reminderDays,
        updatedBy: config.updatedBy,
        updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    console.error('[Admin] Get FREE trial settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FREE trial settings'
    });
  }
};

/**
 * PUT FREE trial settings.
 * Changing duration does NOT rewrite existing workers' trial end dates.
 * Only workers who register after this save receive the new duration.
 */
exports.updateFreeTrialSettings = async (req, res) => {
  try {
    const { enabled, duration, durationUnit, campaignStartDate, reminderDays } = req.body;

    if (enabled === undefined || duration === undefined || !durationUnit) {
      return res.status(400).json({
        success: false,
        message: 'enabled, duration, and durationUnit are required'
      });
    }

    const config = await saveFreeTrialConfig({
      enabled: enabled === true || enabled === 'true',
      duration,
      durationUnit,
      campaignStartDate,
      reminderDays,
      adminId: req.user?.id
    });

    // When FREE trial is turned ON, existing workers who never received one get it now.
    let backfill = { granted: 0, skipped: 0 };
    if (config.enabled) {
      try {
        backfill = await grantFreeTrialToEligibleExistingWorkers();
      } catch (backfillError) {
        console.error('[Admin] FREE trial backfill error:', backfillError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'FREE trial settings updated successfully.',
      data: {
        ...config,
        backfill
      }
    });
  } catch (error) {
    console.error('[Admin] Update FREE trial settings error:', error);
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to update FREE trial settings'
    });
  }
};

/**
 * GET worker dashboard banner settings
 */
exports.getWorkerDashboardBanners = async (req, res) => {
  try {
    const config = await getWorkerDashboardBannerSettings();
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('[Admin] Get worker dashboard banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch worker dashboard banners'
    });
  }
};

/**
 * PUT worker dashboard banner settings
 */
exports.updateWorkerDashboardBanners = async (req, res) => {
  try {
    const { isBannersVisible, banners } = req.body;

    if (!Array.isArray(banners)) {
      return res.status(400).json({
        success: false,
        message: 'banners must be an array'
      });
    }

    const config = await saveWorkerDashboardBannerSettings({
      isBannersVisible: isBannersVisible !== false,
      banners,
      adminId: req.user?.id
    });

    res.status(200).json({
      success: true,
      message: 'Worker dashboard banners updated successfully.',
      data: config
    });
  } catch (error) {
    console.error('[Admin] Update worker dashboard banners error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update worker dashboard banners'
    });
  }
};

/**
 * Delete plan
 */
exports.deletePlan = async (req, res) => {
  try {
    const plan = await WorkerSubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    await plan.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
