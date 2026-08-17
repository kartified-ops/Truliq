/**
 * Indian mobile number normalization.
 *
 * Treats these as the same number:
 *   9876543210
 *   +91 9876543210
 *   +919876543210
 *   919876543210
 */
const normalizePhone = (input) => {
  if (input === undefined || input === null) return '';
  const digits = String(input).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
};

const isValidIndianMobile = (input) => {
  const phone = normalizePhone(input);
  return /^[6-9]\d{9}$/.test(phone);
};

module.exports = {
  normalizePhone,
  isValidIndianMobile
};
