const PromotionalOffer = require('../models/PromotionalOffer');
const { OFFER_TYPES, TARGET_TYPES } = require('../models/PromotionalOffer');
const SubscriptionPause = require('../models/SubscriptionPause');
const Worker = require('../models/Worker');
const {
  toIstDateKey,
  startOfIstDay,
  endOfIstDay,
  inclusiveDurationDays,
  addCalendarDays,
  getOverlappingIstDateKeys,
  eachIstDateKey,
  istDateKeyToUtcStart
} = require('../utils/istDate');
const { isSubscriptionCurrentlyActive } = require('../utils/workerSubscriptionUtil');

const OFFER_STATUS = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  INACTIVE: 'INACTIVE'
});

const computeOfferStatus = (offer, now = new Date()) => {
  if (!offer) return OFFER_STATUS.INACTIVE;
  if (offer.isActive === false) return OFFER_STATUS.INACTIVE;
  const start = new Date(offer.startDate);
  const end = new Date(offer.endDate);
  if (now < start) return OFFER_STATUS.SCHEDULED;
  if (now > end) return OFFER_STATUS.EXPIRED;
  return OFFER_STATUS.ACTIVE;
};

const isOfferWindowOpen = (offer, now = new Date()) => {
  if (!offer || offer.isActive === false) return false;
  return now >= new Date(offer.startDate) && now <= new Date(offer.endDate);
};

const isWorkerTargeted = (offer, workerId) => {
  if (!offer || !workerId) return false;
  if (offer.targetType === TARGET_TYPES.ALL_WORKERS) return true;
  const selected = (offer.selectedWorkers || []).map((id) => String(id));
  return selected.includes(String(workerId));
};

const computeApplicablePauseDays = ({
  subStart,
  subExpiry,
  offerStart,
  offerEnd,
  alreadyPausedKeys = []
}) => {
  const overlapKeys = getOverlappingIstDateKeys({
    subStart,
    subExpiry,
    offerStart,
    offerEnd
  });
  const taken = new Set(alreadyPausedKeys);
  const newKeys = overlapKeys.filter((key) => !taken.has(key));
  return {
    overlapKeys,
    newKeys,
    pausedDays: newKeys.length
  };
};

const getPausedDateKeysForWorker = async (workerId) => {
  const records = await SubscriptionPause.find({ workerId }).select('pausedDateKeys').lean();
  return Array.from(new Set(records.flatMap((record) => record.pausedDateKeys || [])));
};

const findTargetedOffers = async ({ workerId, now = new Date(), includeScheduled = false }) => {
  const query = {
    isActive: true,
    endDate: { $gte: now }
  };
  if (!includeScheduled) {
    query.startDate = { $lte: now };
  }

  const offers = await PromotionalOffer.find(query).lean();
  return offers.filter((offer) => isWorkerTargeted(offer, workerId));
};

const getActivePromotionalOffer = async (workerId, date = new Date()) => {
  if (!workerId) return null;
  const offers = await PromotionalOffer.find({
    isActive: true,
    startDate: { $lte: date },
    endDate: { $gte: date }
  }).sort({ startDate: 1 }).lean();

  return offers.find((offer) => isWorkerTargeted(offer, workerId)) || null;
};

const isFreePlatformFeeActive = async (workerId, date = new Date()) => {
  const offer = await getActivePromotionalOffer(workerId, date);
  return !!(offer && offer.offerType === OFFER_TYPES.FREE_PLATFORM_FEE);
};

/**
 * Existing worker payout stays unchanged. A FREE_PLATFORM_FEE offer
 * forces a 100% worker split (₹0 platform fee) without rewriting Settings.
 */
const getWorkerServiceSplitPct = async ({ workerId, existingSplitPct, date = new Date() }) => {
  if (workerId && await isFreePlatformFeeActive(workerId, date)) {
    return 100;
  }
  return existingSplitPct;
};

const getWorkerWithdrawalPlatformFeeRate = async ({ workerId, existingRate, date = new Date() }) => {
  if (workerId && await isFreePlatformFeeActive(workerId, date)) {
    return 0;
  }
  return existingRate;
};

const restoreActiveIfExpiryInFuture = (worker, now = new Date()) => {
  const expiry = worker?.subscription?.expiryDate;
  if (!expiry) return false;
  if (new Date(expiry).getTime() <= new Date(now).getTime()) return false;
  worker.subscription.isActive = true;
  worker.subscription.status = 'ACTIVE';
  return true;
};

const persistPauseRecord = async ({ existing, offer, worker, newKeys, overlapKeys, previousExpiryDate, newExpiryDate }) => {
  const mergedKeys = Array.from(new Set([
    ...(existing?.pausedDateKeys || []),
    ...newKeys
  ])).sort();
  const pauseStart = mergedKeys[0] || overlapKeys[0];
  const pauseEnd = mergedKeys[mergedKeys.length - 1] || overlapKeys[overlapKeys.length - 1];
  const payload = {
    offerId: offer._id,
    workerId: worker._id,
    pauseStartDate: startOfIstDay(pauseStart),
    pauseEndDate: endOfIstDay(pauseEnd),
    pausedDays: mergedKeys.length,
    pausedDateKeys: mergedKeys,
    previousExpiryDate: existing?.previousExpiryDate || previousExpiryDate,
    newExpiryDate,
    reason: 'PROMOTIONAL_OFFER'
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  return SubscriptionPause.create(payload);
};

const applyOfferToWorker = async (workerOrId, offer, now = new Date(), attempt = 0) => {
  const worker = typeof workerOrId === 'object' && workerOrId?._id
    ? workerOrId
    : await Worker.findById(workerOrId);

  if (!worker || !offer || offer.isActive === false) {
    return { applied: false, reason: 'invalid' };
  }
  if (!isWorkerTargeted(offer, worker._id)) {
    return { applied: false, reason: 'not_targeted' };
  }

  const sub = worker.subscription || {};
  if (!sub.startDate || !sub.expiryDate) {
    return { applied: false, reason: 'no_subscription' };
  }

  const existing = await SubscriptionPause.findOne({
    offerId: offer._id,
    workerId: worker._id
  });

  const alreadyPausedKeys = await getPausedDateKeysForWorker(worker._id);
  const { newKeys, overlapKeys } = computeApplicablePauseDays({
    subStart: sub.startDate,
    subExpiry: sub.expiryDate,
    offerStart: offer.startDate,
    offerEnd: offer.endDate,
    alreadyPausedKeys
  });

  if (!overlapKeys.length) {
    return { applied: false, reason: 'no_overlap' };
  }

  if (existing && newKeys.length === 0) {
    if (existing.newExpiryDate && new Date(sub.expiryDate).getTime() < new Date(existing.newExpiryDate).getTime()) {
      worker.subscription.expiryDate = existing.newExpiryDate;
      restoreActiveIfExpiryInFuture(worker, now);
      await worker.save();
      return {
        applied: true,
        pausedDays: 0,
        pausedDateKeys: [],
        previousExpiryDate: sub.expiryDate,
        newExpiryDate: existing.newExpiryDate,
        reason: 'repaired_expiry'
      };
    }
    return { applied: false, reason: 'already_applied' };
  }

  const previousExpiryDate = sub.expiryDate;
  const newExpiryDate = addCalendarDays(previousExpiryDate, newKeys.length);

  try {
    await persistPauseRecord({
      existing,
      offer,
      worker,
      newKeys,
      overlapKeys,
      previousExpiryDate,
      newExpiryDate: newKeys.length ? newExpiryDate : previousExpiryDate
    });
  } catch (error) {
    if (error.code === 11000) {
      if (attempt >= 2) return { applied: false, reason: 'already_applied' };
      return applyOfferToWorker(worker, offer, now, attempt + 1);
    }
    throw error;
  }

  if (newKeys.length > 0) {
    worker.subscription.expiryDate = newExpiryDate;
    worker.subscription.promotionalPauseDays = (worker.subscription.promotionalPauseDays || 0) + newKeys.length;
    restoreActiveIfExpiryInFuture(worker, now);
    await worker.save();
  }

  return {
    applied: true,
    pausedDays: newKeys.length,
    pausedDateKeys: newKeys,
    previousExpiryDate,
    newExpiryDate: newKeys.length ? newExpiryDate : previousExpiryDate
  };
};

const applyOfferToEligibleWorkers = async (offer) => {
  if (!offer || offer.isActive === false) {
    return { processed: 0, applied: 0 };
  }

  const query = {
    'subscription.startDate': { $ne: null },
    'subscription.expiryDate': { $gt: offer.startDate }
  };
  if (offer.targetType === TARGET_TYPES.SELECTED_WORKERS) {
    query._id = { $in: offer.selectedWorkers || [] };
  }

  const workers = await Worker.find(query);
  let applied = 0;
  for (const worker of workers) {
    const result = await applyOfferToWorker(worker, offer);
    if (result.applied && result.pausedDays > 0) applied += 1;
  }
  return { processed: workers.length, applied };
};

const applyPendingOffersForWorker = async (worker, now = new Date()) => {
  if (!worker?._id) return { applied: 0 };
  const offers = await PromotionalOffer.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: worker.subscription?.startDate || now }
  }).lean();

  let applied = 0;
  for (const offer of offers) {
    const result = await applyOfferToWorker(worker, offer, now);
    if (result.applied && result.pausedDays > 0) applied += 1;
  }
  return { applied };
};

const reverseUnconsumedPauseDays = async (offer, now = new Date()) => {
  const records = await SubscriptionPause.find({ offerId: offer._id });
  const todayKey = toIstDateKey(now);
  let reversedWorkers = 0;

  for (const record of records) {
    const remainingKeys = (record.pausedDateKeys || []).filter((key) => key >= todayKey);
    if (!remainingKeys.length) continue;

    const worker = await Worker.findById(record.workerId);
    if (worker?.subscription?.expiryDate) {
      worker.subscription.expiryDate = addCalendarDays(worker.subscription.expiryDate, -remainingKeys.length);
      worker.subscription.promotionalPauseDays = Math.max(
        0,
        (worker.subscription.promotionalPauseDays || 0) - remainingKeys.length
      );
      await worker.save();
    }

    record.pausedDateKeys = (record.pausedDateKeys || []).filter((key) => key < todayKey);
    record.pausedDays = record.pausedDateKeys.length;
    if (record.pausedDateKeys.length) {
      record.pauseEndDate = endOfIstDay(record.pausedDateKeys[record.pausedDateKeys.length - 1]);
    }
    await record.save();
    reversedWorkers += 1;
  }

  return { reversedWorkers };
};

const cancelOffer = async (offer, now = new Date()) => {
  const status = computeOfferStatus({ ...offer.toObject?.() || offer, isActive: true }, now);
  offer.isActive = false;
  await offer.save();

  if (status === OFFER_STATUS.SCHEDULED) {
    const records = await SubscriptionPause.find({ offerId: offer._id });
    for (const record of records) {
      const worker = await Worker.findById(record.workerId);
      if (worker?.subscription?.expiryDate && record.pausedDays) {
        worker.subscription.expiryDate = addCalendarDays(worker.subscription.expiryDate, -record.pausedDays);
        worker.subscription.promotionalPauseDays = Math.max(
          0,
          (worker.subscription.promotionalPauseDays || 0) - record.pausedDays
        );
        await worker.save();
      }
      await record.deleteOne();
    }
    return { mode: 'full_reversal', reversedWorkers: records.length };
  }

  const result = await reverseUnconsumedPauseDays(offer, now);
  return { mode: 'future_only', ...result };
};

const getOfferStats = async (offer) => {
  const pauses = await SubscriptionPause.find({ offerId: offer._id }).lean();
  const workersBenefited = pauses.filter((row) => (row.pausedDays || 0) > 0).length;
  const totalPromotionalDaysUsed = pauses.reduce((sum, row) => sum + (row.pausedDays || 0), 0);

  let eligibleWorkers = 0;
  if (offer.targetType === TARGET_TYPES.SELECTED_WORKERS) {
    eligibleWorkers = (offer.selectedWorkers || []).length;
  } else {
    eligibleWorkers = await Worker.countDocuments({
      'subscription.startDate': { $ne: null },
      'subscription.expiryDate': { $gt: offer.startDate }
    });
  }

  return {
    eligibleWorkers,
    workersBenefited,
    totalPromotionalDaysUsed
  };
};

const buildSubscriptionTimeline = ({ startDate, expiryDate, pausedKeys = [], now = new Date() }) => {
  if (!startDate) return { consumedDays: 0, entries: [] };

  const paused = new Set(pausedKeys);
  const expiry = expiryDate ? new Date(expiryDate) : null;
  const keys = eachIstDateKey(startDate, now).filter((key) => {
    if (!expiry) return true;
    return istDateKeyToUtcStart(key) < expiry;
  });

  let consumedDays = 0;
  const entries = keys.map((key) => {
    const isPause = paused.has(key);
    if (!isPause) consumedDays += 1;
    return {
      date: key,
      type: isPause ? 'pause' : 'day',
      dayNumber: isPause ? null : consumedDays
    };
  });

  return {
    consumedDays,
    entries: entries.slice(-16)
  };
};

const getWorkerPromotionalState = async (workerId, date = new Date()) => {
  const offer = await getActivePromotionalOffer(workerId, date);
  const pausedKeys = await getPausedDateKeysForWorker(workerId);
  const todayKey = toIstDateKey(date);
  const worker = await Worker.findById(workerId).select('subscription').lean();
  const sub = worker?.subscription || {};
  const timeline = buildSubscriptionTimeline({
    startDate: sub.startDate,
    expiryDate: sub.expiryDate,
    pausedKeys,
    now: date
  });
  const windowOpen = !!(offer && isOfferWindowOpen(offer, date));
  const eligibleNow = isSubscriptionCurrentlyActive(sub, date) || pausedKeys.includes(todayKey);
  const isPausedToday = windowOpen && eligibleNow;

  if (!offer && !pausedKeys.length) {
    return {
      isActive: false,
      isPausedToday: false,
      platformFee: null,
      subscriptionDay: timeline.consumedDays,
      timeline: timeline.entries,
      pausedDateKeys: pausedKeys
    };
  }

  return {
    isActive: windowOpen && eligibleNow,
    isPausedToday,
    name: offer?.name || null,
    description: offer?.description || null,
    offerType: offer?.offerType || null,
    startDate: offer?.startDate || null,
    endDate: offer?.endDate || null,
    durationDays: offer?.durationDays || null,
    platformFee: offer?.offerType === OFFER_TYPES.FREE_PLATFORM_FEE && windowOpen ? 0 : null,
    pausedDaysApplied: pausedKeys.length,
    subscriptionDay: timeline.consumedDays,
    timeline: timeline.entries,
    pausedDateKeys: pausedKeys
  };
};

const buildOfferPayload = (body, { existing } = {}) => {
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const offerType = body.offerType || OFFER_TYPES.FREE_PLATFORM_FEE;
  const targetType = body.targetType || TARGET_TYPES.ALL_WORKERS;
  const selectedWorkers = Array.isArray(body.selectedWorkers) ? body.selectedWorkers : [];

  if (!name) throw new Error('Offer name is required.');
  if (!Object.values(OFFER_TYPES).includes(offerType)) {
    throw new Error('Invalid offer type.');
  }
  if (!Object.values(TARGET_TYPES).includes(targetType)) {
    throw new Error('Invalid target audience.');
  }
  if (targetType === TARGET_TYPES.SELECTED_WORKERS && selectedWorkers.length === 0) {
    throw new Error('Select at least one worker for this offer.');
  }

  const startDate = startOfIstDay(body.startDate);
  const endDate = endOfIstDay(body.endDate);
  if (!startDate || !endDate) throw new Error('Start date and end date are required.');
  if (startDate > endDate) throw new Error('End date must be on or after start date.');

  const durationDays = inclusiveDurationDays(startDate, endDate);
  if (durationDays < 1) throw new Error('Offer duration must be at least 1 day.');

  return {
    name,
    description,
    offerType,
    targetType,
    selectedWorkers: targetType === TARGET_TYPES.SELECTED_WORKERS ? selectedWorkers : [],
    startDate,
    endDate,
    durationDays,
    isActive: body.isActive !== undefined ? body.isActive !== false : (existing?.isActive !== false)
  };
};

module.exports = {
  OFFER_TYPES,
  TARGET_TYPES,
  OFFER_STATUS,
  computeOfferStatus,
  isOfferWindowOpen,
  isWorkerTargeted,
  computeApplicablePauseDays,
  getPausedDateKeysForWorker,
  getActivePromotionalOffer,
  isFreePlatformFeeActive,
  getWorkerServiceSplitPct,
  getWorkerWithdrawalPlatformFeeRate,
  applyOfferToWorker,
  applyOfferToEligibleWorkers,
  applyPendingOffersForWorker,
  cancelOffer,
  getOfferStats,
  getWorkerPromotionalState,
  buildSubscriptionTimeline,
  buildOfferPayload,
  findTargetedOffers
};
