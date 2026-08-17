const Settings = require('../models/Settings');
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
const { PLAN_TYPES, SUBSCRIPTION_STATUS } = require('../utils/workerSubscriptionUtil');

const TRIAL_PLAN_NAME = 'FREE TRIAL';

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
    updatedBy: cfg.updatedBy || null,
    updatedAt: cfg.updatedAt || null
  };
};

const saveFreeTrialConfig = async ({ enabled, duration, durationUnit, adminId }) => {
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
    const err = new Error('Duration unit must be DAY or MONTH');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  const update = {
    'workerFreeTrial.enabled': enabled,
    'workerFreeTrial.duration': parsedDuration,
    'workerFreeTrial.durationUnit': unit,
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
    updatedBy: cfg.updatedBy || null,
    updatedAt: cfg.updatedAt || null
  };
};

/**
 * Pure eligibility decision used by registration AND tests.
 * history is the permanent per-phone record (survives account deletion).
 */
const evaluateTrialEligibility = ({ config, history }) => {
  if (!config || config.enabled !== true) {
    return { eligible: false, reason: 'DISABLED' };
  }
  if (history?.trialUsed) {
    return { eligible: false, reason: 'ALREADY_USED' };
  }
  if (history?.everPaid) {
    return { eligible: false, reason: 'PAID_USER' };
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
 * Unique index on WorkerTrialHistory.phone + filter on trialUsed/everPaid
 * prevents two concurrent registrations from both receiving a trial.
 */
const grantFreeTrialIfEligible = async (worker, options = {}) => {
  const session = options.session;
  const phone = normalizePhone(worker.phone);
  if (!phone) {
    return { granted: false, reason: 'INVALID_PHONE', subscription: null };
  }

  const config = await getFreeTrialConfig();
  if (!config.enabled) {
    return { granted: false, reason: 'DISABLED', subscription: null, config };
  }

  const now = options.now ? new Date(options.now) : new Date();
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

  let claimed = false;
  try {
    const query = WorkerTrialHistory.findOneAndUpdate(
      {
        phone,
        trialUsed: { $ne: true },
        everPaid: { $ne: true }
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
        includeResultMetadata: true,
        ...(session ? { session } : {})
      }
    );
    await query;
    claimed = true;
  } catch (err) {
    if (err && err.code === 11000) {
      return { granted: false, reason: 'ALREADY_USED', subscription: null, config };
    }
    throw err;
  }

  if (!claimed) {
    return { granted: false, reason: 'ALREADY_USED', subscription: null, config };
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
 * Mark this mobile number as having purchased a paid plan.
 * Prevents a later re-registration from receiving a FREE trial.
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
  markPhoneAsPaid,
  buildTrialSubscription
};
