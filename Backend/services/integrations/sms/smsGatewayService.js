const { SERVICE_KEYS } = require('../../../config/integrationProviders');
const { resolveConfig } = require('../../integrationConfigService');
const smsIndiaHubAdapter = require('./smsIndiaHubAdapter');
const twilioAdapter = require('./twilioAdapter');
const genericHttpAdapter = require('./genericHttpAdapter');

const ADAPTERS = Object.freeze({
  sms_india_hub: smsIndiaHubAdapter,
  twilio: twilioAdapter
});

const resolveAdapter = (providerId, credentials = {}) => {
  if (ADAPTERS[providerId]) return ADAPTERS[providerId];
  if (credentials.accountSid && credentials.authToken) return twilioAdapter;
  return genericHttpAdapter;
};

const getActiveSmsConfig = async () => {
  const config = await resolveConfig(SERVICE_KEYS.SMS);
  if (!config) return null;
  const providerId = config.configuration?.activeProvider || config.provider || 'sms_india_hub';
  const credentials = config.configuration?.providerProfiles?.[providerId]
    || config.credentials
    || {};
  const adapter = resolveAdapter(providerId, credentials);
  return {
    providerId,
    adapter,
    credentials: {
      ...credentials,
      apiUrl: credentials.apiUrl || config.configuration?.apiUrl
    },
    enabled: config.enabled !== false,
    source: config.source
  };
};

const sendSms = async (phone, message) => {
  if (process.env.USE_DEFAULT_OTP === 'true') {
    console.log(`[SMS MOCK] To: ${phone}, Msg: ${message}`);
    return { success: true, data: 'Mock Success' };
  }

  const active = await getActiveSmsConfig();
  if (!active || !active.enabled) {
    return { success: false, message: 'SMS configuration missing' };
  }
  try {
    return await active.adapter.sendSms(active.credentials, phone, message);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const getSmsCredentials = async () => {
  const active = await getActiveSmsConfig();
  if (!active) return { enabled: false, source: 'none', provider: null };
  return {
    provider: active.providerId,
    enabled: active.enabled,
    apiKey: active.credentials.apiKey || '',
    senderId: active.credentials.senderId || '',
    dltTemplateId: active.credentials.dltTemplateId || '',
    username: active.credentials.username || '',
    apiUrl: active.credentials.apiUrl || '',
    source: active.source
  };
};

const testProvider = async (providerId, credentials, options = {}) => {
  const adapter = resolveAdapter(providerId, credentials);
  return adapter.testConnection(credentials, options);
};

module.exports = {
  ADAPTERS,
  getActiveSmsConfig,
  sendSms,
  getSmsCredentials,
  testProvider
};
