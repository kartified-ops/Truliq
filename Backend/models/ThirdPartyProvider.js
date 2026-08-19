const mongoose = require('mongoose');

const SERVICE_TYPES = Object.freeze([
  'sms', 'payment_gateway', 'maps', 'firebase', 'storage', 'email',
  'recaptcha', 'kyc', 'notification_channel', 'other'
]);

const HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const AUTH_TYPES = Object.freeze([
  'none', 'api_key', 'bearer_token', 'basic_auth', 'header', 'query_param'
]);

const headerSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true },
  isSecret: { type: Boolean, default: false }
}, { _id: false });

const queryParamSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true },
  isSecret: { type: Boolean, default: false }
}, { _id: false });

const thirdPartyProviderSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    required: true,
    enum: SERVICE_TYPES,
    index: true
  },
  providerName: {
    type: String,
    required: true,
    trim: true
  },
  providerSlug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: false,
    index: true
  },
  environment: {
    type: String,
    enum: ['test', 'production'],
    default: 'production'
  },

  // Whether this provider uses a built-in adapter (razorpay, firebase, etc.)
  // or the generic HTTP engine
  useGenericEngine: {
    type: Boolean,
    default: true
  },
  adapterKey: {
    type: String,
    default: null,
    trim: true
  },

  // ── Generic HTTP Engine Configuration ──
  apiUrl: { type: String, default: '', trim: true },
  httpMethod: { type: String, enum: HTTP_METHODS, default: 'POST' },
  authenticationType: { type: String, enum: AUTH_TYPES, default: 'api_key' },

  // Encrypted credential fields
  credentials: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // HTTP headers (value may contain {{apiKey}} etc.)
  headers: { type: [headerSchema], default: [] },

  // Query parameters (value may contain {{apiKey}} etc.)
  queryParams: { type: [queryParamSchema], default: [] },

  // Request body template (JSON string with {{variable}} placeholders)
  requestBodyTemplate: { type: String, default: '' },

  // Content type
  contentType: {
    type: String,
    enum: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'],
    default: 'application/json'
  },

  // Response parsing
  responseSuccessPath: { type: String, default: '', trim: true },
  responseSuccessValue: { type: String, default: '', trim: true },
  responseMessagePath: { type: String, default: '', trim: true },

  // Service-specific variable mappings
  variableMapping: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Additional service-specific configuration (e.g. OTP template for SMS)
  configuration: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Test result
  lastTestedAt: { type: Date, default: null },
  lastTestStatus: { type: String, enum: ['success', 'failed', null], default: null },
  lastTestMessage: { type: String, default: '' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, {
  timestamps: true
});

thirdPartyProviderSchema.index({ serviceType: 1, isActive: 1 });
thirdPartyProviderSchema.index({ serviceType: 1, providerSlug: 1 }, { unique: true });

module.exports = mongoose.model('ThirdPartyProvider', thirdPartyProviderSchema);
module.exports.SERVICE_TYPES = SERVICE_TYPES;
module.exports.HTTP_METHODS = HTTP_METHODS;
module.exports.AUTH_TYPES = AUTH_TYPES;
