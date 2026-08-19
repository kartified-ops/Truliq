const mongoose = require('mongoose');

const credentialAccessLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  adminEmail: {
    type: String,
    default: ''
  },
  serviceName: {
    type: String,
    required: true,
    index: true
  },
  providerId: {
    type: String,
    required: true
  },
  field: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CredentialAccessLog', credentialAccessLogSchema);
