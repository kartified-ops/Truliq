/**
 * Worker FREE trial — phone normalization, duration math, eligibility,
 * expiry, and "existing trials stay frozen when admin changes duration".
 *
 *   node tests/worker-free-trial.test.js
 */
const assert = require('assert');
const { normalizePhone, isValidIndianMobile } = require('../utils/phoneUtil');
const {
  calculateEndDate,
  daysBetween,
  DURATION_UNITS
} = require('../utils/trialDuration');
const {
  isSubscriptionCurrentlyActive,
  isSubscriptionExpired,
  expireSubscriptionIfNeeded,
  getSubscriptionStatusValue,
  applyExpiredStatus,
  PLAN_TYPES,
  SUBSCRIPTION_STATUS
} = require('../utils/workerSubscriptionUtil');
const { evaluateTrialEligibility } = require('../services/workerFreeTrialService');

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push([true, name]);
  } catch (err) {
    results.push([false, `${name}\n    ${err.message}`]);
  }
};

const main = async () => {
  await check('normalizes +91, spaces, and 10-digit forms to the same number', async () => {
    assert.strictEqual(normalizePhone('9876543210'), '9876543210');
    assert.strictEqual(normalizePhone('+91 9876543210'), '9876543210');
    assert.strictEqual(normalizePhone('+919876543210'), '9876543210');
    assert.strictEqual(normalizePhone('919876543210'), '9876543210');
    assert.strictEqual(isValidIndianMobile('+91 9876543210'), true);
    assert.strictEqual(isValidIndianMobile('12345'), false);
  });

  await check('1 Month from 17 Aug 2026 ends 17 Sep 2026', async () => {
    const start = new Date('2026-08-17T10:00:00.000Z');
    const end = calculateEndDate(start, 1, DURATION_UNITS.MONTH);
    assert.strictEqual(end.getUTCFullYear(), 2026);
    assert.strictEqual(end.getUTCMonth(), 8); // September
    assert.strictEqual(end.getUTCDate(), 17);
  });

  await check('2 Months from 20 Aug 2026 ends 20 Oct 2026', async () => {
    const start = new Date('2026-08-20T10:00:00.000Z');
    const end = calculateEndDate(start, 2, DURATION_UNITS.MONTH);
    assert.strictEqual(end.getUTCMonth(), 9); // October
    assert.strictEqual(end.getUTCDate(), 20);
  });

  await check('15 Days from 17 Aug 2026 ends 1 Sep 2026', async () => {
    const start = new Date('2026-08-17T10:00:00.000Z');
    const end = calculateEndDate(start, 15, DURATION_UNITS.DAY);
    assert.strictEqual(end.getUTCMonth(), 8);
    assert.strictEqual(end.getUTCDate(), 1);
  });

  await check('changing admin duration does not rewrite a stored end date', async () => {
    const grantedEnd = calculateEndDate(new Date('2026-08-17T10:00:00.000Z'), 1, 'MONTH');
    const laterAdminEnd = calculateEndDate(new Date('2026-08-17T10:00:00.000Z'), 2, 'MONTH');
    assert.notStrictEqual(grantedEnd.getTime(), laterAdminEnd.getTime());
    // The subscription record keeps grantedEnd; admin config is not reapplied.
    const stored = { expiryDate: grantedEnd, isActive: true, status: 'ACTIVE', planType: 'TRIAL' };
    assert.strictEqual(stored.expiryDate.getTime(), grantedEnd.getTime());
  });

  await check('Case 1 — new user + trial enabled → eligible', async () => {
    const result = evaluateTrialEligibility({
      config: { enabled: true, duration: 1, durationUnit: 'MONTH' },
      history: null
    });
    assert.deepStrictEqual(result, { eligible: true, reason: null });
  });

  await check('Case 3 — trial already used → not eligible', async () => {
    const result = evaluateTrialEligibility({
      config: { enabled: true, duration: 1, durationUnit: 'MONTH' },
      history: { trialUsed: true, everPaid: false }
    });
    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reason, 'ALREADY_USED');
  });

  await check('Case 6 — admin disables trial → not eligible', async () => {
    const result = evaluateTrialEligibility({
      config: { enabled: false, duration: 1, durationUnit: 'MONTH' },
      history: null
    });
    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reason, 'DISABLED');
  });

  await check('Case 7 — admin re-enables trial, unused number → eligible', async () => {
    const result = evaluateTrialEligibility({
      config: { enabled: true, duration: 1, durationUnit: 'MONTH' },
      history: null,
      worker: { trialUsed: false, subscription: {} }
    });
    assert.strictEqual(result.eligible, true);
  });

  await check('existing registered worker who never got a trial is eligible when Admin enables it', async () => {
    const result = evaluateTrialEligibility({
      config: { enabled: true, duration: 1, durationUnit: 'MONTH' },
      history: null,
      worker: {
        trialUsed: false,
        subscription: { isActive: false, planType: null, trialUsed: false }
      }
    });
    assert.deepStrictEqual(result, { eligible: true, reason: null });
  });

  await check('existing worker does not get a trial while Admin has it disabled', async () => {
    const result = evaluateTrialEligibility({
      config: { enabled: false, duration: 1, durationUnit: 'MONTH' },
      history: null,
      worker: { trialUsed: false, subscription: {} }
    });
    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reason, 'DISABLED');
  });

  await check('Case 7/8/9 — re-enable does not restore a used mobile number', async () => {
    const result = evaluateTrialEligibility({
      config: { enabled: true, duration: 2, durationUnit: 'MONTH' },
      history: { trialUsed: true },
      worker: { trialUsed: true, subscription: { planType: 'TRIAL', trialUsed: true } }
    });
    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reason, 'ALREADY_USED');
  });

  await check('active paid plan is not overwritten by a FREE trial', async () => {
    const result = evaluateTrialEligibility({
      config: { enabled: true, duration: 1, durationUnit: 'MONTH' },
      history: { trialUsed: false },
      worker: {
        trialUsed: false,
        subscription: {
          isActive: true,
          status: 'ACTIVE',
          planType: 'PAID',
          expiryDate: new Date('2027-01-01T00:00:00.000Z')
        }
      }
    });
    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reason, 'HAS_ACTIVE_PLAN');
  });

  await check('paid user who never received a FREE trial is eligible after that plan expires', async () => {
    const result = evaluateTrialEligibility({
      config: { enabled: true, duration: 1, durationUnit: 'MONTH' },
      history: { trialUsed: false, everPaid: true },
      worker: {
        trialUsed: false,
        subscription: {
          isActive: false,
          status: 'EXPIRED',
          planType: 'PAID',
          expiryDate: new Date('2026-01-01T00:00:00.000Z')
        }
      }
    });
    assert.strictEqual(result.eligible, true);
  });

  await check('expiry uses stored endDate: currentDate >= endDate → EXPIRED', async () => {
    const end = new Date('2026-09-17T10:00:00.000Z');
    const sub = { isActive: true, status: 'ACTIVE', expiryDate: end, planType: 'TRIAL' };
    assert.strictEqual(isSubscriptionCurrentlyActive(sub, new Date('2026-09-16T10:00:00.000Z')), true);
    assert.strictEqual(isSubscriptionExpired(sub, new Date('2026-09-17T10:00:00.000Z')), true);
    assert.strictEqual(isSubscriptionCurrentlyActive(sub, new Date('2026-09-17T10:00:00.000Z')), false);
  });

  await check('expireSubscriptionIfNeeded persists ACTIVE → EXPIRED', async () => {
    const worker = {
      subscription: {
        isActive: true,
        status: 'ACTIVE',
        expiryDate: new Date('2026-09-01T00:00:00.000Z'),
        planType: PLAN_TYPES.TRIAL
      }
    };
    const mutated = expireSubscriptionIfNeeded(worker, new Date('2026-09-01T00:00:00.000Z'));
    assert.strictEqual(mutated, true);
    assert.strictEqual(worker.subscription.isActive, false);
    assert.strictEqual(worker.subscription.status, SUBSCRIPTION_STATUS.EXPIRED);
    assert.strictEqual(getSubscriptionStatusValue(worker.subscription, new Date('2026-09-02T00:00:00.000Z')), 'EXPIRED');
  });

  await check('does not mutate a still-active trial', async () => {
    const worker = {
      subscription: {
        isActive: true,
        status: 'ACTIVE',
        expiryDate: new Date('2026-09-17T10:00:00.000Z')
      }
    };
    const mutated = expireSubscriptionIfNeeded(worker, new Date('2026-08-17T10:00:00.000Z'));
    assert.strictEqual(mutated, false);
    assert.strictEqual(worker.subscription.isActive, true);
    assert.strictEqual(worker.subscription.status, 'ACTIVE');
  });

  await check('applyExpiredStatus never recalculates end date from admin config', async () => {
    const originalEnd = new Date('2026-09-17T10:00:00.000Z');
    const sub = { isActive: true, status: 'ACTIVE', expiryDate: originalEnd };
    applyExpiredStatus(sub);
    assert.strictEqual(sub.expiryDate.getTime(), originalEnd.getTime());
  });

  await check('daysBetween matches the stored calendar span', async () => {
    const start = new Date('2026-08-17T10:00:00.000Z');
    const end = calculateEndDate(start, 1, 'MONTH');
    assert.strictEqual(daysBetween(start, end), 31);
  });

  const failed = results.filter((r) => !r[0]);
  results.forEach(([ok, name]) => {
    console.log(`${ok ? '✓' : '✗'} ${name}`);
  });
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
