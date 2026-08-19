const crypto = require('crypto');
const { SERVICE_KEYS } = require('../../../config/integrationProviders');
const { resolveConfig, registerRefreshHook } = require('../../integrationConfigService');
const razorpayAdapter = require('./razorpayAdapter');

const ADAPTERS = Object.freeze({
  razorpay: razorpayAdapter
});

let cachedClient = null;
let cachedFingerprint = '';

registerRefreshHook(() => {
  cachedClient = null;
  cachedFingerprint = '';
});

const getActivePaymentConfig = async () => {
  const config = await resolveConfig(SERVICE_KEYS.PAYMENT_GATEWAY);
  if (!config || config.enabled === false) {
    return null;
  }
  const providerId = config.configuration?.activeProvider || config.provider || 'razorpay';
  const adapter = ADAPTERS[providerId];
  if (!adapter) {
    throw new Error(`Payment provider "${providerId}" is not supported.`);
  }
  const credentials = config.configuration?.providerProfiles?.[providerId]
    || config.credentials
    || {};
  return {
    providerId,
    adapter,
    credentials,
    environment: config.environment || 'production',
    enabled: config.enabled !== false,
    source: config.source
  };
};

const getClient = async () => {
  const active = await getActivePaymentConfig();
  if (!active || active.providerId !== 'razorpay') {
    return { client: null, active, keyId: '', keySecret: '' };
  }
  const { keyId, keySecret } = active.adapter.resolveKeys(active.credentials, active.environment);
  if (!keyId || !keySecret) return { client: null, active, keyId: '', keySecret: '' };
  const fingerprint = `${keyId}:${keySecret.length}`;
  if (!cachedClient || cachedFingerprint !== fingerprint) {
    cachedClient = active.adapter.createClient(keyId, keySecret);
    cachedFingerprint = fingerprint;
  }
  return { client: cachedClient, active, keyId, keySecret };
};

const getCredentials = async () => {
  const active = await getActivePaymentConfig();
  if (!active || active.providerId !== 'razorpay') {
    return {
      provider: active?.providerId || null,
      keyId: '',
      keySecret: '',
      webhookSecret: '',
      environment: active?.environment || 'production',
      enabled: false,
      source: active?.source || 'none'
    };
  }
  const { keyId, keySecret } = active.adapter.resolveKeys(active.credentials, active.environment);
  return {
    provider: active.providerId,
    keyId,
    keySecret,
    webhookSecret: active.credentials.webhookSecret || '',
    environment: active.environment,
    enabled: active.enabled,
    source: active.source
  };
};

const verifySignature = async (orderId, paymentId, signature) => {
  if (!orderId || orderId.startsWith('order_mock_')) return true;
  const creds = await getCredentials();
  if (!creds.keySecret) return true;
  const generated = crypto
    .createHmac('sha256', creds.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return generated === signature;
};

const testProvider = async (providerId, credentials, environment) => {
  const adapter = ADAPTERS[providerId];
  if (!adapter) return { success: false, message: 'Provider not supported.' };
  return adapter.testConnection(credentials, environment);
};

module.exports = {
  ADAPTERS,
  getActivePaymentConfig,
  getClient,
  getCredentials,
  verifySignature,
  testProvider
};
