const mongoose = require('mongoose');

const ENVIRONMENTS = Object.freeze(['test', 'production']);

const integrationConfigSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  provider: {
    type: String,
    required: true,
    trim: true
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  environment: {
    type: String,
    enum: ENVIRONMENTS,
    default: 'production'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  credentials: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  configuration: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastTestedAt: {
    type: Date,
    default: null
  },
  lastTestStatus: {
    type: String,
    enum: ['success', 'failed', 'pending', null],
    default: null
  },
  lastTestMessage: {
    type: String,
    default: ''
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, {
  timestamps: true
});

integrationConfigSchema.index({ serviceName: 1, provider: 1 });

module.exports = mongoose.model('IntegrationConfig', integrationConfigSchema);
module.exports.ENVIRONMENTS = ENVIRONMENTS;
