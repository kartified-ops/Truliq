const mongoose = require('mongoose');
const { DURATION_UNITS } = require('../utils/trialDuration');

/**
 * Permanent per-mobile-number trial/payment history.
 * Survives account deletion so ONE MOBILE = ONE FREE TRIAL EVER.
 */
const workerTrialHistorySchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  trialUsed: {
    type: Boolean,
    default: false,
    index: true
  },
  everPaid: {
    type: Boolean,
    default: false
  },
  trialDuration: {
    type: Number,
    default: null
  },
  trialDurationUnit: {
    type: String,
    enum: Object.values(DURATION_UNITS),
    default: null
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  firstGrantedAt: {
    type: Date,
    default: null
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WorkerTrialHistory', workerTrialHistorySchema);
