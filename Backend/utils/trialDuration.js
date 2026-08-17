const DURATION_UNITS = Object.freeze({
  DAY: 'DAY',
  MONTH: 'MONTH'
});

const DEFAULT_TRIAL_DURATION = 1;
const DEFAULT_TRIAL_DURATION_UNIT = DURATION_UNITS.MONTH;

/**
 * Calendar-accurate end date from a start date + duration/unit.
 * 17 Aug + 1 MONTH → 17 Sep (not a hardcoded 30 days).
 */
const calculateEndDate = (startDate, duration, unit) => {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }

  const amount = Number(duration);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error('Duration must be a positive integer');
  }

  const end = new Date(start);
  const normalizedUnit = String(unit || '').toUpperCase();

  if (normalizedUnit === DURATION_UNITS.MONTH) {
    end.setMonth(end.getMonth() + amount);
  } else if (normalizedUnit === DURATION_UNITS.DAY) {
    end.setDate(end.getDate() + amount);
  } else {
    throw new Error('Unsupported duration unit');
  }

  return end;
};

const daysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
};

const isValidDurationUnit = (unit) => {
  const normalized = String(unit || '').toUpperCase();
  return normalized === DURATION_UNITS.DAY || normalized === DURATION_UNITS.MONTH;
};

const normalizeDurationUnit = (unit) => String(unit || '').toUpperCase();

module.exports = {
  DURATION_UNITS,
  DEFAULT_TRIAL_DURATION,
  DEFAULT_TRIAL_DURATION_UNIT,
  calculateEndDate,
  daysBetween,
  isValidDurationUnit,
  normalizeDurationUnit
};
