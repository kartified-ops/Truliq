/**
 * India calendar-day helpers.
 * Promotional offers are full IST calendar days, inclusive of start and end.
 */
const APP_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

const toIstDateKey = (input) => {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;
};

const istDateKeyToUtcStart = (key) => {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
};

const startOfIstDay = (input) => {
  const key = toIstDateKey(input);
  return key ? istDateKeyToUtcStart(key) : null;
};

const endOfIstDay = (input) => {
  const start = startOfIstDay(input);
  return start ? new Date(start.getTime() + DAY_MS - 1) : null;
};

const inclusiveDurationDays = (startInput, endInput) => {
  const startKey = toIstDateKey(startInput);
  const endKey = toIstDateKey(endInput);
  if (!startKey || !endKey) return 0;
  const diff = (istDateKeyToUtcStart(endKey) - istDateKeyToUtcStart(startKey)) / DAY_MS;
  return Math.round(diff) + 1;
};

const eachIstDateKey = (startInput, endInput) => {
  const startKey = toIstDateKey(startInput);
  const endKey = toIstDateKey(endInput);
  if (!startKey || !endKey) return [];
  const keys = [];
  let cursor = istDateKeyToUtcStart(startKey);
  const last = istDateKeyToUtcStart(endKey);
  while (cursor <= last) {
    keys.push(toIstDateKey(cursor));
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return keys;
};

const addCalendarDays = (input, days) => {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  date.setTime(date.getTime() + (Number(days) || 0) * DAY_MS);
  return date;
};

/**
 * Unique IST calendar days where an offer overlaps an active subscription.
 * Subscription is treated as [startDate, expiryDate).
 */
const getOverlappingIstDateKeys = ({ subStart, subExpiry, offerStart, offerEnd }) => {
  if (!subStart || !subExpiry || !offerStart || !offerEnd) return [];
  const start = new Date(subStart);
  const expiry = new Date(subExpiry);
  if (!(start < expiry)) return [];

  return eachIstDateKey(offerStart, offerEnd).filter((key) => {
    const dayStart = istDateKeyToUtcStart(key);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    return dayStart < expiry && dayEnd > start;
  });
};

module.exports = {
  APP_TIMEZONE,
  DAY_MS,
  toIstDateKey,
  istDateKeyToUtcStart,
  startOfIstDay,
  endOfIstDay,
  inclusiveDurationDays,
  eachIstDateKey,
  addCalendarDays,
  getOverlappingIstDateKeys
};
