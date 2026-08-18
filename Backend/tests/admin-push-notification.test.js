/**
 * Admin push notification service tests
 *
 *   node tests/admin-push-notification.test.js
 */
const assert = require('assert');
const {
  AUDIENCE_TYPES,
  CLICK_ACTIONS,
  getAllowedActionsForAudience,
  buildLinkForRole,
  validateActionForAudience
} = require('../services/adminPushNotificationService');

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
  await check('worker audience allows open jobs action', async () => {
    const actions = getAllowedActionsForAudience(AUDIENCE_TYPES.WORKERS);
    assert.ok(actions.includes(CLICK_ACTIONS.OPEN_JOBS));
    assert.ok(!actions.includes(CLICK_ACTIONS.OPEN_BOOKING_DETAILS));
  });

  await check('all audience only allows actions common to every role', async () => {
    const actions = getAllowedActionsForAudience(AUDIENCE_TYPES.ALL);
    assert.ok(actions.includes(CLICK_ACTIONS.OPEN_HOME));
    assert.ok(actions.includes(CLICK_ACTIONS.OPEN_WALLET));
    assert.ok(!actions.includes(CLICK_ACTIONS.OPEN_JOBS));
    assert.ok(!actions.includes(CLICK_ACTIONS.OPEN_JOB_DETAILS));
  });

  await check('job details action requires target id', async () => {
    const invalid = validateActionForAudience({
      audienceType: AUDIENCE_TYPES.WORKERS,
      action: CLICK_ACTIONS.OPEN_JOB_DETAILS,
      targetId: ''
    });
    assert.strictEqual(invalid.valid, false);

    const valid = validateActionForAudience({
      audienceType: AUDIENCE_TYPES.WORKERS,
      action: CLICK_ACTIONS.OPEN_JOB_DETAILS,
      targetId: '64f1a67f520c62f83a158ed5'
    });
    assert.strictEqual(valid.valid, true);
  });

  await check('builds role-safe deep links', async () => {
    assert.strictEqual(buildLinkForRole('worker', CLICK_ACTIONS.OPEN_JOBS), '/worker/jobs');
    assert.strictEqual(buildLinkForRole('worker', CLICK_ACTIONS.OPEN_JOB_DETAILS, 'job123'), '/worker/job/job123');
    assert.strictEqual(buildLinkForRole('user', CLICK_ACTIONS.OPEN_BOOKING_DETAILS, 'booking123'), '/user/booking/booking123');
    assert.strictEqual(buildLinkForRole('vendor', CLICK_ACTIONS.OPEN_BOOKING_DETAILS, 'booking123'), '/vendor/booking/booking123');
  });

  const passed = results.filter(([ok]) => ok).length;
  const failed = results.length - passed;

  results.forEach(([ok, name]) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  });

  console.log(`\n${passed}/${results.length} tests passed`);
  if (failed > 0) process.exit(1);
};

main();
