const mongoose = require('mongoose');

const integrationAuditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  serviceName: {
    type: String,
    required: true,
    index: true
  },
  provider: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    required: true,
    enum: [
      'create',
      'update',
      'enable',
      'disable',
      'test',
      'provider_change',
      'environment_change'
    ]
  },
  success: {
    type: Boolean,
    default: true
  },
  message: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

integrationAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('IntegrationAuditLog', integrationAuditLogSchema);
