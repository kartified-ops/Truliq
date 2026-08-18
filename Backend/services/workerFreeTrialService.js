const Settings = require('../models/Settings');
const Worker = require('../models/Worker');
const WorkerTrialHistory = require('../models/WorkerTrialHistory');
const { normalizePhone } = require('../utils/phoneUtil');
const {
  DURATION_UNITS,
  DEFAULT_TRIAL_DURATION,
  DEFAULT_TRIAL_DURATION_UNIT,
  calculateEndDate,
  daysBetween,
  isValidDurationUnit,
  normalizeDurationUnit
} = require('../utils/trialDuration');
const {
  PLAN_TYPES,
  SUBSCRIPTION_STATUS,
  isSubscriptionCurrentlyActive,
  expireSubscriptionIfNeeded
} = require('../utils/workerSubscriptionUtil');

const TRIAL_PLAN_NAME = 'FREE SUBSCRIPTION';

const getDefaultFreeTrialConfig = () => ({
  enabled: true,
  duration: DEFAULT_TRIAL_DURATION,
  durationUnit: DEFAULT_TRIAL_DURATION_UNIT
});

/**
 * Read the currently active Admin FREE trial configuration from Settings.
 * Never hardcode duration in registration logic.
 */
const getFreeTrialConfig = async () => {
  const settings = await Settings.findOne({ type: 'global' }).lean();
  const cfg = settings?.workerFreeTrial || {};
  const duration = Number(cfg.duration);
  const durationUnit = isValidDurationUnit(cfg.durationUnit)
    ? normalizeDurationUnit(cfg.durationUnit)
    : DEFAULT_TRIAL_DURATION_UNIT;

  return {
    enabled: cfg.enabled !== false,
    duration: Number.isInteger(duration) && duration >= 1 ? duration : DEFAULT_TRIAL_DURATION,
    durationUnit,
    campaignStartDate: cfg.campaignStartDate ? new Date(cfg.campaignStartDate).toISOString() : null,
    reminderDays: Number.isInteger(Number(cfg.reminderDays)) ? Number(cfg.reminderDays) : 3,
    updatedBy: cfg.updatedBy || null,
    updatedAt: cfg.updatedAt || null
  };
};

const saveFreeTrialConfig = async ({ enabled, duration, durationUnit, campaignStartDate, reminderDays, adminId }) => {
  const parsedDuration = Number(duration);
  const unit = normalizeDurationUnit(durationUnit);

  if (typeof enabled !== 'boolean') {
    const err = new Error('enabled must be a boolean');
    err.status = 400;
    throw err;
  }
  if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
    const err = new Error('Duration must be a positive integer');
    err.status = 400;
    throw err;
  }
  if (!isValidDurationUnit(unit)) {
    const err = new Error('Duration unit must be DAY, WEEK, or MONTH');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const update = {
    'workerFreeTrial.enabled': enabled,
    'workerFreeTrial.duration': parsedDuration,
    'workerFreeTrial.durationUnit': unit,
    'workerFreeTrial.campaignStartDate': campaignStartDate ? new Date(campaignStartDate) : null,
    'workerFreeTrial.reminderDays': Number.isInteger(Number(reminderDays)) ? Number(reminderDays) : 3,
    'workerFreeTrial.updatedAt': now
  };
  if (adminId) update['workerFreeTrial.updatedBy'] = adminId;

  const settings = await Settings.findOneAndUpdate(
    { type: 'global' },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const cfg = settings.workerFreeTrial || {};
  return {
    enabled: cfg.enabled !== false,
    duration: cfg.duration,
    durationUnit: cfg.durationUnit,
    campaignStartDate: cfg.campaignStartDate ? new Date(cfg.campaignStartDate).toISOString() : null,
    reminderDays: cfg.reminderDays ?? 3,
    updatedBy: cfg.updatedBy || null,
    updatedAt: cfg.updatedAt || null
  };
};

const workerAlreadyConsumedTrial = (worker) => !!(
  worker?.trialUsed ||
  worker?.subscription?.trialUsed ||
  worker?.subscription?.planType === PLAN_TYPES.TRIAL
);

/**
 * Pure eligibility decision used by registration, backfill, login, AND tests.
 *
 * Existing workers who never received a FREE trial become eligible as soon as
 * Admin enables the feature. Workers who already consumed a trial never get another.
 * An active paid plan is not overwritten.
 */
const evaluateTrialEligibility = ({ config, history, worker }) => {
  if (!config || config.enabled !== true) {
    return { eligible: false, reason: 'DISABLED' };
  }
  if (history?.trialUsed || workerAlreadyConsumedTrial(worker)) {
    return { eligible: false, reason: 'ALREADY_USED' };
  }
  if (worker && isSubscriptionCurrentlyActive(worker.subscription)) {
    return { eligible: false, reason: 'HAS_ACTIVE_PLAN' };
  }
  return { eligible: true, reason: null };
};

const getTrialHistoryByPhone = async (phone, session) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const query = WorkerTrialHistory.findOne({ phone: normalized });
  if (session) query.session(session);
  return query.lean();
};

const buildTrialSubscription = ({ now, endDate, duration, durationUnit }) => ({
  isActive: true,
  planId: null,
  planName: TRIAL_PLAN_NAME,
  planType: PLAN_TYPES.TRIAL,
  status: SUBSCRIPTION_STATUS.ACTIVE,
  trialUsed: true,
  trialDuration: duration,
  trialDurationUnit: durationUnit,
  startDate: now,
  expiryDate: endDate,
  durationDays: daysBetween(now, endDate),
  amountPaid: 0,
  paymentDate: null,
  transactionId: null,
  lastPaymentId: null,
  lastOrderId: null
});

/**
 * Atomically consume the one-time FREE trial for this mobile number and
 * attach a TRIAL subscription snapshot (duration frozen at grant time).
 *
 * Also used for already-registered workers who never received a trial:
 * when Admin enables FREE trial, they become eligible.
 *
 * Unique index on WorkerTrialHistory.phone + trialUsed filter prevents
 * two concurrent grants for the same mobile number.
 */
const grantFreeTrialIfEligible = async (worker, options = {}) => {
  const session = options.session;
  const phone = normalizePhone(worker.phone);
  if (!phone) {
    return { granted: false, reason: 'INVALID_PHONE', subscription: null };
  }

  const config = options.config || await getFreeTrialConfig();
  const now = options.now ? new Date(options.now) : new Date();
  expireSubscriptionIfNeeded(worker, now);

  const history = options.history !== undefined
    ? options.history
    : await getTrialHistoryByPhone(phone, session);

  const decision = evaluateTrialEligibility({ config, history, worker });
  if (!decision.eligible) {
    return { granted: false, reason: decision.reason, subscription: null, config };
  }

  const endDate = calculateEndDate(now, config.duration, config.durationUnit);
  const trialFields = {
    trialUsed: true,
    trialDuration: config.duration,
    trialDurationUnit: config.durationUnit,
    startDate: now,
    endDate,
    firstGrantedAt: now,
    workerId: worker._id
  };

  try {
    await WorkerTrialHistory.findOneAndUpdate(
      {
        phone,
        trialUsed: { $ne: true }
      },
      {
        $set: trialFields,
        $setOnInsert: {
          phone,
          everPaid: false
        }
      },
      {
        upsert: true,
        new: true,
        ...(session ? { session } : {})
      }
    );
  } catch (err) {
    if (err && err.code === 11000) {
      return { granted: false, reason: 'ALREADY_USED', subscription: null, config };
    }
    throw err;
  }

  const subscription = buildTrialSubscription({
    now,
    endDate,
    duration: config.duration,
    durationUnit: config.durationUnit
  });

  worker.trialUsed = true;
  worker.subscription = subscription;
  await worker.save(session ? { session } : undefined);

  return { granted: true, reason: null, subscription, config };
};

/**
 * When Admin enables FREE trial, grant it to every existing worker who
 * has never consumed a trial and does not currently have an active plan.
 */
const grantFreeTrialToEligibleExistingWorkers = async () => {
  const config = await getFreeTrialConfig();
  if (!config.enabled) {
    return { granted: 0, skipped: 0 };
  }

  const now = new Date();
  const workers = await Worker.find({
    trialUsed: { $ne: true },
    'subscription.trialUsed': { $ne: true },
    'subscription.planType': { $ne: PLAN_TYPES.TRIAL }
  }).select('phone trialUsed subscription');

  let granted = 0;
  let skipped = 0;

  for (const worker of workers) {
    try {
      const result = await grantFreeTrialIfEligible(worker, { config, now });
      if (result.granted) granted += 1;
      else skipped += 1;
    } catch (err) {
      skipped += 1;
      console.error(`[FreeTrial] Backfill failed for worker ${worker._id}:`, err.message);
    }
  }

  return { granted, skipped };
};

/**
 * Mark this mobile number as having purchased a paid plan.
 */
const markPhoneAsPaid = async (phone, workerId, session) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return;

  await WorkerTrialHistory.findOneAndUpdate(
    { phone: normalized },
    {
      $set: {
        everPaid: true,
        workerId: workerId || null
      },
      $setOnInsert: {
        phone: normalized,
        trialUsed: false
      }
    },
    {
      upsert: true,
      new: true,
      ...(session ? { session } : {})
    }
  );
};

module.exports = {
  TRIAL_PLAN_NAME,
  DURATION_UNITS,
  getDefaultFreeTrialConfig,
  getFreeTrialConfig,
  saveFreeTrialConfig,
  evaluateTrialEligibility,
  getTrialHistoryByPhone,
  grantFreeTrialIfEligible,
  grantFreeTrialToEligibleExistingWorkers,
  markPhoneAsPaid,
  buildTrialSubscription,
  workerAlreadyConsumedTrial
};
