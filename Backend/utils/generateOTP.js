/**
 * Generate OTP and Token utilities
 */

/**
 * Generate a random OTP of specified length
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} - Generated OTP
 */
const generateOTP = (length = 6, phone = null) => {
  const cleanPhone = (phone || '').toString().replace(/\D/g, '').slice(-10);
  // Static OTP for 6266925739 or default OTP mode
  if (cleanPhone === '6266925739' || process.env.USE_DEFAULT_OTP === 'true') {
    return '123456';
  }

  const digits = '0123456789';
  let OTP = '';
  const len = typeof length === 'number' ? length : 6;
  for (let i = 0; i < len; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  return OTP;
};

/**
 * Generate a random token of specified length
 * @param {number} length - Length of token (default: 32)
 * @returns {string} - Generated token
 */
const generateToken = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

module.exports = {
  generateOTP,
  generateToken
};

