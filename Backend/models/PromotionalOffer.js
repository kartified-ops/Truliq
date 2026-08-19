const mongoose = require('mongoose');

const OFFER_TYPES = Object.freeze({
  FREE_PLATFORM_FEE: 'FREE_PLATFORM_FEE'
});

const TARGET_TYPES = Object.freeze({
  ALL_WORKERS: 'ALL_WORKERS',
  SELECTED_WORKERS: 'SELECTED_WORKERS'
});

const promotionalOfferSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  offerType: {
    type: String,
    enum: Object.values(OFFER_TYPES),
    default: OFFER_TYPES.FREE_PLATFORM_FEE,
    required: true,
    index: true
  },
  targetType: {
    type: String,
    enum: Object.values(TARGET_TYPES),
    default: TARGET_TYPES.ALL_WORKERS,
    required: true
  },
  selectedWorkers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker'
  }],
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  durationDays: {
    type: Number,
    required: true,
    min: 1
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, {
  timestamps: true
});

promotionalOfferSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('PromotionalOffer', promotionalOfferSchema);
module.exports.OFFER_TYPES = OFFER_TYPES;
module.exports.TARGET_TYPES = TARGET_TYPES;
