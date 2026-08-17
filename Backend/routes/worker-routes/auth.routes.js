const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  sendOTP,
  register,
  login,
  logout,
  refreshToken,
  verifyLogin
} = require('../../controllers/workerControllers/workerAuthController');
const { authenticate } = require('../../middleware/authMiddleware');
const { isWorker } = require('../../middleware/roleMiddleware');
const { normalizePhone } = require('../../utils/phoneUtil');

const phoneRule = body('phone')
  .customSanitizer((value) => normalizePhone(value))
  .notEmpty().withMessage('Phone number is required')
  .matches(/^[6-9]\d{9}$/).withMessage('Phone number must be a valid 10-digit mobile number');

// Validation rules
const sendOTPValidation = [
  phoneRule,
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Please provide a valid email')
];

const verifyLoginValidation = [
  phoneRule,
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
];

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  phoneRule,
  body('email').isEmail().withMessage('Please provide a valid email')
  // otp/token optional (handled by controller)
];

const loginValidation = [
  phoneRule,
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('token').trim().notEmpty().withMessage('Verification token is required')
];

// Routes
router.post('/send-otp', sendOTPValidation, sendOTP);
router.post('/verify-login', verifyLoginValidation, verifyLogin); // New Unified Entry
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticate, isWorker, logout);

module.exports = router;
