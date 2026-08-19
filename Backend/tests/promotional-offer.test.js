/**
 * Promotional offer — IST duration, overlap, pause-day extension, dedupe.
 *
 *   node tests/promotional-offer.test.js
 */
const assert = require('assert');
const {
  toIstDateKey,
  inclusiveDurationDays,
  addCalendarDays,
  startOfIstDay,
  endOfIstDay,
  getOverlappingIstDateKeys
} = require('../utils/istDate');
const { computeApplicablePauseDays, computeOfferStatus, OFFER_STATUS } = require('../services/promotionalOfferService');

const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push([true, name]);
  } catch (err) {
    results.push([false, `${name}\n    ${err.message}`]);
  }
};

const ist = (isoDate, hours = 10) => {
  // Build an IST local time then convert to UTC Date.
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hours - 5, minutesFromOffset(hours), 0));
};

function minutesFromOffset(hours) {
  // hours IST = hours-5:30 UTC
  return (hours - 5) * 60 - 30 < 0 ? 30 : 0;
}

const atIst = (dateStr, hour = 10, minute = 0) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  // IST = UTC+5:30 → UTC = IST - 5:30
  const utcHour = hour - 5;
  const utcMinute = minute - 30;
  return new Date(Date.UTC(y, m - 1, d, utcHour, utcMinute, 0));
};

const main = async () => {
  await check('inclusive duration: 13 Aug → 13 Aug is 1 day', async () => {
    assert.strictEqual(inclusiveDurationDays(atIst('2026-08-13', 0), atIst('2026-08-13', 23)), 1);
  });

  await check('inclusive duration: 13 Aug → 15 Aug is 3 days', async () => {
    assert.strictEqual(inclusiveDurationDays(atIst('2026-08-13', 0), atIst('2026-08-15', 23)), 3);
  });

  await check('Test 1 — one-day offer extends expiry by 1 day', async () => {
    const subStart = atIst('2026-08-01', 10);
    const subExpiry = atIst('2026-08-30', 10);
    const offerStart = startOfIstDay(atIst('2026-08-13', 0));
    const offerEnd = endOfIstDay(atIst('2026-08-13', 23));
    const { newKeys, pausedDays } = computeApplicablePauseDays({
      subStart, subExpiry, offerStart, offerEnd
    });
    assert.strictEqual(pausedDays, 1);
    assert.deepStrictEqual(newKeys, ['2026-08-13']);
    const newExpiry = addCalendarDays(subExpiry, pausedDays);
    assert.strictEqual(toIstDateKey(newExpiry), '2026-08-31');
  });

  await check('Test 2 — three-day offer extends expiry by 3 days (30 Aug → 02 Sep)', async () => {
    const subStart = atIst('2026-08-01', 10);
    const subExpiry = atIst('2026-08-30', 10);
    const offerStart = startOfIstDay(atIst('2026-08-13', 0));
    const offerEnd = endOfIstDay(atIst('2026-08-15', 23));
    const { pausedDays } = computeApplicablePauseDays({
      subStart, subExpiry, offerStart, offerEnd
    });
    assert.strictEqual(pausedDays, 3);
    const newExpiry = addCalendarDays(subExpiry, pausedDays);
    assert.strictEqual(toIstDateKey(newExpiry), '2026-09-02');
  });

  await check('Test 3 — offer after subscription expiry does not extend', async () => {
    const { pausedDays, overlapKeys } = computeApplicablePauseDays({
      subStart: atIst('2026-08-01', 10),
      subExpiry: atIst('2026-08-10', 10),
      offerStart: startOfIstDay(atIst('2026-08-13', 0)),
      offerEnd: endOfIstDay(atIst('2026-08-15', 23))
    });
    assert.strictEqual(overlapKeys.length, 0);
    assert.strictEqual(pausedDays, 0);
  });

  await check('Test 4 expiry — 6 overlapping days extend 20 Aug to 26 Aug', async () => {
    const subExpiry = atIst('2026-08-20', 10);
    const newExpiry = addCalendarDays(subExpiry, 6);
    assert.strictEqual(toIstDateKey(newExpiry), '2026-08-26');
  });

  await check('timeline skips promotional pause days in consumed count', async () => {
    const { buildSubscriptionTimeline } = require('../services/promotionalOfferService');
    const result = buildSubscriptionTimeline({
      startDate: atIst('2026-08-01', 10),
      expiryDate: atIst('2026-08-31', 10),
      pausedKeys: ['2026-08-13'],
      now: atIst('2026-08-14', 10)
    });
    assert.strictEqual(result.consumedDays, 13);
    const pause = result.entries.find((row) => row.date === '2026-08-13');
    assert.ok(pause && pause.type === 'pause');
    const day13 = result.entries.find((row) => row.date === '2026-08-14');
    assert.strictEqual(day13.dayNumber, 13);
  });

  await check('Test 4 — offer overlapping subscription end only pauses 15–20 Aug (6 days)', async () => {
    const { newKeys, pausedDays } = computeApplicablePauseDays({
      subStart: atIst('2026-08-01', 10),
      subExpiry: atIst('2026-08-20', 10),
      offerStart: startOfIstDay(atIst('2026-08-15', 0)),
      offerEnd: endOfIstDay(atIst('2026-08-25', 23))
    });
    assert.strictEqual(pausedDays, 6);
    assert.strictEqual(newKeys[0], '2026-08-15');
    assert.strictEqual(newKeys[newKeys.length - 1], '2026-08-20');
  });

  await check('Test 5 — subscription starts during offer: 14–15 paused (2 days)', async () => {
    const { newKeys, pausedDays } = computeApplicablePauseDays({
      subStart: atIst('2026-08-14', 10),
      subExpiry: atIst('2026-09-13', 10),
      offerStart: startOfIstDay(atIst('2026-08-13', 0)),
      offerEnd: endOfIstDay(atIst('2026-08-15', 23))
    });
    assert.strictEqual(pausedDays, 2);
    assert.deepStrictEqual(newKeys, ['2026-08-14', '2026-08-15']);
  });

  await check('Test 6 — duplicate request does not extend again', async () => {
    const args = {
      subStart: atIst('2026-08-01', 10),
      subExpiry: atIst('2026-08-30', 10),
      offerStart: startOfIstDay(atIst('2026-08-13', 0)),
      offerEnd: endOfIstDay(atIst('2026-08-13', 23)),
      alreadyPausedKeys: ['2026-08-13']
    };
    const { pausedDays } = computeApplicablePauseDays(args);
    assert.strictEqual(pausedDays, 0);
  });

  await check('Test 7 — overlapping offers count a shared date only once', async () => {
    const subStart = atIst('2026-08-01', 10);
    const subExpiry = atIst('2026-08-30', 10);
    const offerA = computeApplicablePauseDays({
      subStart,
      subExpiry,
      offerStart: startOfIstDay(atIst('2026-08-13', 0)),
      offerEnd: endOfIstDay(atIst('2026-08-15', 23))
    });
    const offerB = computeApplicablePauseDays({
      subStart,
      subExpiry,
      offerStart: startOfIstDay(atIst('2026-08-15', 0)),
      offerEnd: endOfIstDay(atIst('2026-08-17', 23)),
      alreadyPausedKeys: offerA.newKeys
    });
    assert.strictEqual(offerA.pausedDays, 3);
    assert.deepStrictEqual(offerB.newKeys, ['2026-08-16', '2026-08-17']);
    assert.strictEqual(offerA.pausedDays + offerB.pausedDays, 5);
  });

  await check('Test 8 — no offer means zero pause days', async () => {
    const keys = getOverlappingIstDateKeys({
      subStart: atIst('2026-08-01', 10),
      subExpiry: atIst('2026-08-30', 10),
      offerStart: null,
      offerEnd: null
    });
    assert.strictEqual(keys.length, 0);
  });

  await check('offer status: scheduled / active / expired / inactive', async () => {
    const offer = {
      isActive: true,
      startDate: startOfIstDay(atIst('2026-08-13', 0)),
      endDate: endOfIstDay(atIst('2026-08-15', 23))
    };
    assert.strictEqual(computeOfferStatus(offer, atIst('2026-08-12', 10)), OFFER_STATUS.SCHEDULED);
    assert.strictEqual(computeOfferStatus(offer, atIst('2026-08-13', 10)), OFFER_STATUS.ACTIVE);
    assert.strictEqual(computeOfferStatus(offer, atIst('2026-08-16', 10)), OFFER_STATUS.EXPIRED);
    assert.strictEqual(computeOfferStatus({ ...offer, isActive: false }, atIst('2026-08-13', 10)), OFFER_STATUS.INACTIVE);
  });

  await check('Test 9 conceptually — FREE_PLATFORM_FEE days still pause the clock', async () => {
    const { pausedDays } = computeApplicablePauseDays({
      subStart: atIst('2026-08-01', 10),
      subExpiry: atIst('2026-08-30', 10),
      offerStart: startOfIstDay(atIst('2026-08-13', 0)),
      offerEnd: endOfIstDay(atIst('2026-08-13', 23))
    });
    assert.strictEqual(pausedDays, 1);
  });

  await check('Test 13 — offer overlaps subscription start: 15–20 Aug is 6 days', async () => {
    const { newKeys, pausedDays } = computeApplicablePauseDays({
      subStart: atIst('2026-08-15', 10),
      subExpiry: atIst('2026-08-30', 10),
      offerStart: startOfIstDay(atIst('2026-08-10', 0)),
      offerEnd: endOfIstDay(atIst('2026-08-20', 23))
    });
    assert.strictEqual(pausedDays, 6);
    assert.strictEqual(newKeys[0], '2026-08-15');
    assert.strictEqual(newKeys[newKeys.length - 1], '2026-08-20');
  });

  await check('buildOfferPayload rejects end date before start date', async () => {
    const { buildOfferPayload } = require('../services/promotionalOfferService');
    assert.throws(
      () => buildOfferPayload({ name: 'Festival Offer', startDate: '2026-08-20', endDate: '2026-08-15' }),
      /End date must be on or after start date/
    );
  });

  await check('buildOfferPayload rejects empty selected workers', async () => {
    const { buildOfferPayload } = require('../services/promotionalOfferService');
    assert.throws(
      () => buildOfferPayload({
        name: 'Festival Offer',
        startDate: '2026-08-13',
        endDate: '2026-08-13',
        targetType: 'SELECTED_WORKERS',
        selectedWorkers: []
      }),
      /Select at least one worker/
    );
  });

  const passed = results.filter(([ok]) => ok).length;
  results.forEach(([ok, name]) => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`));
  console.log(`\n${passed}/${results.length} tests passed`);
  if (passed !== results.length) process.exit(1);
};

main();
