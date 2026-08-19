const mongoose = require('mongoose');

const subscriptionPauseSchema = new mongoose.Schema({
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromotionalOffer',
    required: true,
    index: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true,
    index: true
  },
  pauseStartDate: {
    type: Date,
    required: true
  },
  pauseEndDate: {
    type: Date,
    required: true
  },
  pausedDays: {
    type: Number,
    required: true,
    min: 0
  },
  pausedDateKeys: {
    type: [String],
    default: []
  },
  previousExpiryDate: {
    type: Date,
    default: null
  },
  newExpiryDate: {
    type: Date,
    default: null
  },
  reason: {
    type: String,
    default: 'PROMOTIONAL_OFFER'
  }
}, {
  timestamps: true
});

subscriptionPauseSchema.index({ offerId: 1, workerId: 1 }, { unique: true });
subscriptionPauseSchema.index({ workerId: 1, pausedDateKeys: 1 });

module.exports = mongoose.model('SubscriptionPause', subscriptionPauseSchema);
