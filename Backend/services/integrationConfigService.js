const IntegrationConfig = require('../models/IntegrationConfig');
const IntegrationAuditLog = require('../models/IntegrationAuditLog');
const {
  encryptSecret,
  decryptSecret,
  isEncryptedValue,
  maskSecret
} = require('../utils/credentialEncryption');
const {
  SERVICE_KEYS,
  getServiceCatalog,
  getAllCatalogs,
  getActiveProviders,
  assertActiveProvider,
  getSensitiveFields,
  getPublicFields,
  normalizeServiceKey
} = require('../config/integrationProviders');

const SERVICE_NAMES = Object.freeze({
  PAYMENT_GATEWAY: SERVICE_KEYS.PAYMENT_GATEWAY,
  SMS: SERVICE_KEYS.SMS,
  MAPS: SERVICE_KEYS.MAPS,
  FIREBASE: SERVICE_KEYS.FIREBASE,
  CLOUDINARY: 'cloudinary',
  STORAGE: SERVICE_KEYS.STORAGE,
  EMAIL: SERVICE_KEYS.EMAIL,
  RECAPTCHA: SERVICE_KEYS.RECAPTCHA,
  KYC: SERVICE_KEYS.KYC,
  NOTIFICATION_CHANNEL: SERVICE_KEYS.NOTIFICATION_CHANNEL
});

const MANAGED_SERVICES = Object.freeze([
  SERVICE_NAMES.PAYMENT_GATEWAY,
  SERVICE_NAMES.SMS,
  SERVICE_NAMES.MAPS,
  SERVICE_NAMES.FIREBASE,
  SERVICE_NAMES.STORAGE,
  SERVICE_NAMES.EMAIL,
  SERVICE_NAMES.RECAPTCHA,
  SERVICE_NAMES.KYC,
  SERVICE_NAMES.NOTIFICATION_CHANNEL
]);

const LEGACY_SERVICE_ALIASES = Object.freeze({
  cloudinary: SERVICE_KEYS.STORAGE
});

const resolveServiceKey = (serviceName) => {
  const normalized = normalizeServiceKey(serviceName);
  return LEGACY_SERVICE_ALIASES[serviceName] || normalized || serviceName;
};

const normalizeProviderId = (serviceKey, providerId) => {
  if (!providerId) return providerId;
  if ((serviceKey === SERVICE_KEYS.FIREBASE || serviceKey === SERVICE_KEYS.NOTIFICATION_CHANNEL)
    && providerId === 'firebase') {
    return 'firebase_fcm';
  }
  return providerId;
};

const getDefinition = (serviceName) => {
  const serviceKey = resolveServiceKey(serviceName);
  const catalog = getServiceCatalog(serviceKey);
  if (!catalog) return null;
  const activeList = getActiveProviders(serviceKey);
  return {
    serviceKey,
    label: catalog.label,
    providers: catalog.providers.map((p) => p.id),
    activeProviders: activeList.map((p) => p.id),
    defaultProvider: activeList[0]?.id || catalog.providers[0]?.id,
    routeKey: catalog.routeKey,
    catalog
  };
};

const encryptProviderCredentials = (serviceKey, providerId, credentials = {}) => {
  const sensitiveFields = getProviderSensitiveFields(serviceKey, providerId);
  const next = { ...credentials };
  sensitiveFields.forEach((field) => {
    if (next[field] !== undefined && next[field] !== null && next[field] !== '') {
      next[field] = encryptSecret(String(next[field]));
    }
  });
  return next;
};

const decryptProviderCredentials = (serviceKey, providerId, credentials = {}) => {
  const sensitiveFields = getProviderSensitiveFields(serviceKey, providerId);
  const next = { ...credentials };
  sensitiveFields.forEach((field) => {
    if (next[field]) {
      try {
        next[field] = decryptSecret(next[field]);
      } catch (err) {
        console.error(`[IntegrationConfig] Failed to decrypt ${serviceKey}.${providerId}.${field}`);
        next[field] = '';
      }
    }
  });
  return next;
};

const getProviderSensitiveFields = (serviceKey, providerId) => {
  const pid = normalizeProviderId(serviceKey, providerId);
  return getSensitiveFields(serviceKey, pid);
};

const getProviderPublicFields = (serviceKey, providerId) => {
  const pid = normalizeProviderId(serviceKey, providerId);
  return getPublicFields(serviceKey, pid);
};

const maskProviderCredentials = (serviceKey, providerId, credentials = {}) => {
  const publicFields = getProviderPublicFields(serviceKey, providerId);
  const sensitiveFields = getProviderSensitiveFields(serviceKey, providerId);
  const masked = {};
  publicFields.forEach((field) => {
    masked[field] = credentials[field] ?? '';
  });
  sensitiveFields.forEach((field) => {
    if (credentials[field]) {
      masked[field] = maskSecret(isEncryptedValue(credentials[field]) ? '********' : credentials[field]);
      masked[`${field}Configured`] = true;
    } else {
      masked[field] = '';
      masked[`${field}Configured`] = false;
    }
  });
  return masked;
};

const ENV_FIELD_MAP = Object.freeze({
  [SERVICE_NAMES.PAYMENT_GATEWAY]: () => {
    const testKeyId = process.env.RAZORPAY_TEST_KEY_ID || (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test') ? process.env.RAZORPAY_KEY_ID : '');
    const testSecretKey = process.env.RAZORPAY_TEST_SECRET_KEY || (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test') ? process.env.RAZORPAY_KEY_SECRET : '');
    const liveKeyId = process.env.RAZORPAY_LIVE_KEY_ID || (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live') ? process.env.RAZORPAY_KEY_ID : (!process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test') ? process.env.RAZORPAY_KEY_ID : ''));
    const liveSecretKey = process.env.RAZORPAY_LIVE_SECRET_KEY || (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live') ? process.env.RAZORPAY_KEY_SECRET : (!process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test') ? process.env.RAZORPAY_KEY_SECRET : ''));
    const keyId = testKeyId || liveKeyId || process.env.RAZORPAY_KEY_ID || '';
    const secret = testSecretKey || liveSecretKey || process.env.RAZORPAY_KEY_SECRET || '';
    const isTest = keyId.startsWith('rzp_test');
    const credentials = {
      testKeyId,
      testSecretKey,
      liveKeyId,
      liveSecretKey,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || ''
    };
    return {
      provider: 'razorpay',
      enabled: !!(keyId && secret),
      environment: isTest ? 'test' : 'production',
      credentials,
      configuration: {
        activeProvider: 'razorpay',
        providerProfiles: { razorpay: credentials }
      },
      source: 'env'
    };
  },
  [SERVICE_NAMES.SMS]: () => {
    const credentials = {
      apiKey: process.env.SMS_INDIA_HUB_API_KEY || '',
      senderId: process.env.SMS_INDIA_HUB_SENDER_ID || '',
      dltTemplateId: process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID || '',
      username: process.env.SMS_INDIA_HUB_USERNAME || '',
      apiUrl: process.env.SMS_BASE_URL || 'https://cloud.smsindiahub.in/vendorsms/pushsms.aspx'
    };
    return {
      provider: 'sms_india_hub',
      enabled: !!(credentials.apiKey && credentials.senderId),
      environment: 'production',
      credentials,
      configuration: {
        activeProvider: 'sms_india_hub',
        providerProfiles: { sms_india_hub: credentials }
      },
      source: 'env'
    };
  },
  [SERVICE_NAMES.MAPS]: () => {
    const credentials = { apiKey: process.env.GOOGLE_MAPS_API_KEY || '' };
    return {
      provider: 'google_maps',
      enabled: !!credentials.apiKey,
      environment: 'production',
      credentials,
      configuration: {
        mapId: process.env.GOOGLE_MAPS_MAP_ID || '',
        activeProvider: 'google_maps',
        providerProfiles: { google_maps: credentials }
      },
      source: 'env'
    };
  },
  [SERVICE_NAMES.FIREBASE]: () => {
    let json = process.env.FIREBASE_CONFIG || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
    if (!json && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      try {
        const path = require('path');
        json = JSON.stringify(require(path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH)));
      } catch (_) {
        json = '';
      }
    }
    let projectId = '';
    try {
      if (json) projectId = JSON.parse(json).project_id || '';
    } catch (_) { /* ignore */ }
    const credentials = { serviceAccountJson: json };
    return {
      provider: 'firebase_fcm',
      enabled: !!json,
      environment: 'production',
      credentials,
      configuration: {
        databaseUrl: process.env.FIREBASE_DATABASE_URL || 'https://truliq-default-rtdb.asia-southeast1.firebasedatabase.app/',
        projectId,
        activeProvider: 'firebase_fcm',
        providerProfiles: { firebase_fcm: credentials }
      },
      source: 'env'
    };
  },
  [SERVICE_NAMES.STORAGE]: () => {
    const credentials = {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || ''
    };
    return {
      provider: 'cloudinary',
      enabled: !!(credentials.cloudName && credentials.apiKey && credentials.apiSecret),
      environment: 'production',
      credentials,
      configuration: {
        defaultFolder: 'appzeto',
        activeProvider: 'cloudinary',
        providerProfiles: { cloudinary: credentials }
      },
      source: 'env'
    };
  },
  [SERVICE_NAMES.EMAIL]: () => {
    const credentials = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || '587',
      user: process.env.EMAIL_USER || '',
      password: process.env.EMAIL_PASS || '',
      from: process.env.EMAIL_FROM || '',
      fromName: process.env.EMAIL_FROM_NAME || '',
      encryption: 'tls'
    };
    return {
      provider: 'smtp',
      enabled: !!(credentials.user && credentials.password),
      environment: 'production',
      credentials,
      configuration: {
        activeProvider: 'smtp',
        providerProfiles: { smtp: credentials }
      },
      source: 'env'
    };
  }
});

const resolvedCache = new Map();
const CACHE_TTL_MS = 30_000;
const refreshHooks = new Set();

const registerRefreshHook = (fn) => {
  refreshHooks.add(fn);
  return () => refreshHooks.delete(fn);
};

const invalidateCache = (serviceName = null) => {
  if (serviceName) {
    const key = resolveServiceKey(serviceName);
    resolvedCache.delete(key);
    resolvedCache.delete(serviceName);
  } else {
    resolvedCache.clear();
  }
  refreshHooks.forEach((hook) => {
    try { hook(serviceName); } catch (err) {
      console.error('[IntegrationConfig] Refresh hook failed:', err.message);
    }
  });
};

const mergeCredentials = (existing = {}, incoming = {}, sensitiveFields = []) => {
  const merged = { ...existing };
  Object.entries(incoming).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value === '' && sensitiveFields.includes(key)) return;
    if (value === null) return;
    merged[key] = value;
  });
  return merged;
};

const getDbConfig = async (serviceName) => {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) return null;
  const serviceKey = resolveServiceKey(serviceName);
  let doc = await IntegrationConfig.findOne({ serviceName: serviceKey }).lean();
  if (!doc && serviceKey !== serviceName) {
    doc = await IntegrationConfig.findOne({ serviceName }).lean();
  }
  return doc;
};

const getEnvFallback = (serviceName) => {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
  } catch (_) { /* ignore */ }
  const serviceKey = resolveServiceKey(serviceName);
  const builder = ENV_FIELD_MAP[serviceKey];
  return builder ? builder() : null;
};

const resolveActiveProvider = (config, serviceKey) => {
  const active = config.configuration?.activeProvider || config.provider;
  return normalizeProviderId(serviceKey, active) || getDefinition(serviceKey)?.defaultProvider;
};

const resolveActiveCredentials = (config, serviceKey) => {
  const activeProvider = resolveActiveProvider(config, serviceKey);
  const profiles = config.configuration?.providerProfiles || {};
  const profileRaw = profiles[activeProvider];
  if (profileRaw && Object.keys(profileRaw).length) {
    return decryptProviderCredentials(serviceKey, activeProvider, profileRaw);
  }
  if (config.credentials && Object.keys(config.credentials).length) {
    const provider = normalizeProviderId(serviceKey, config.provider) || activeProvider;
    return decryptProviderCredentials(serviceKey, provider, config.credentials);
  }
  return {};
};

const resolveConfig = async (serviceName, { skipCache = false } = {}) => {
  const serviceKey = resolveServiceKey(serviceName);
  if (!skipCache) {
    const cached = resolvedCache.get(serviceKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const dbDoc = await getDbConfig(serviceKey);
  let resolved;

  if (dbDoc && ((dbDoc.credentials && Object.keys(dbDoc.credentials).length)
    || dbDoc.configuration?.providerProfiles)) {
    const configuration = dbDoc.configuration || {};
    const activeProvider = resolveActiveProvider({ ...dbDoc, configuration }, serviceKey);
    const credentials = resolveActiveCredentials({
      ...dbDoc,
      configuration,
      provider: activeProvider
    }, serviceKey);

    resolved = {
      serviceName: serviceKey,
      provider: activeProvider,
      enabled: dbDoc.enabled !== false,
      environment: dbDoc.environment || 'production',
      isActive: dbDoc.isActive !== false,
      credentials,
      configuration,
      lastTestedAt: dbDoc.lastTestedAt,
      lastTestStatus: dbDoc.lastTestStatus,
      lastTestMessage: dbDoc.lastTestMessage,
      updatedAt: dbDoc.updatedAt,
      source: 'database'
    };
  } else {
    const envConfig = getEnvFallback(serviceKey);
    if (envConfig) {
      const activeProvider = resolveActiveProvider(envConfig, serviceKey);
      resolved = {
        serviceName: serviceKey,
        ...envConfig,
        provider: activeProvider,
        credentials: resolveActiveCredentials(envConfig, serviceKey)
      };
    } else {
      resolved = null;
    }
  }

  if (resolved) {
    resolvedCache.set(serviceKey, { value: resolved, at: Date.now() });
  }
  return resolved;
};

const getPaymentGatewayCredentials = async () => {
  try {
    const { getCredentials } = require('./integrations/payment/paymentGatewayService');
    return getCredentials();
  } catch (_) {
    return {
      provider: null, keyId: '', keySecret: '', webhookSecret: '', environment: 'production', enabled: false, source: 'none'
    };
  }
};

const getSmsCredentials = async () => {
  try {
    const { getSmsCredentials: getSmsCreds } = require('./integrations/sms/smsGatewayService');
    return getSmsCreds();
  } catch (_) {
    return { enabled: false, source: 'none', provider: null };
  }
};

const getMapsCredentials = async () => {
  const config = await resolveConfig(SERVICE_NAMES.MAPS);
  if (!config) return { apiKey: '', mapId: '', enabled: false, source: 'none' };
  return {
    apiKey: config.credentials?.apiKey || '',
    mapId: config.configuration?.mapId || '',
    enabled: config.enabled !== false,
    source: config.source
  };
};

const getFirebaseCredentials = async () => {
  const config = await resolveConfig(SERVICE_NAMES.FIREBASE);
  if (!config) return { serviceAccount: null, databaseUrl: '', enabled: false, source: 'none' };
  let serviceAccount = null;
  const raw = config.credentials?.serviceAccountJson || '';
  if (raw) {
    try {
      serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) {
      serviceAccount = null;
    }
  }
  return {
    serviceAccount,
    databaseUrl: config.configuration?.databaseUrl || '',
    projectId: config.configuration?.projectId || serviceAccount?.project_id || '',
    enabled: config.enabled !== false && !!serviceAccount,
    source: config.source
  };
};

const getCloudinaryCredentials = async () => {
  const config = await resolveConfig(SERVICE_NAMES.STORAGE);
  if (!config) {
    return { cloudName: '', apiKey: '', apiSecret: '', enabled: false, source: 'none' };
  }
  return {
    cloudName: config.credentials?.cloudName || '',
    apiKey: config.credentials?.apiKey || '',
    apiSecret: config.credentials?.apiSecret || '',
    defaultFolder: config.configuration?.defaultFolder || 'appzeto',
    enabled: config.enabled !== false,
    source: config.source
  };
};

const getEmailCredentials = async () => {
  const config = await resolveConfig(SERVICE_NAMES.EMAIL);
  if (!config) return { enabled: false, source: 'none' };
  const creds = config.credentials || {};
  return {
    host: creds.host || 'smtp.gmail.com',
    port: parseInt(creds.port, 10) || 587,
    user: creds.user || '',
    pass: creds.password || '',
    from: creds.from || creds.user || '',
    fromName: creds.fromName || '',
    encryption: creds.encryption || 'tls',
    enabled: config.enabled !== false,
    source: config.source
  };
};

const getPublicClientConfig = async () => {
  const [payment, maps] = await Promise.all([
    getPaymentGatewayCredentials(),
    getMapsCredentials()
  ]);
  return {
    razorpayKeyId: payment.keyId || process.env.RAZORPAY_KEY_ID || '',
    googleMapsApiKey: maps.apiKey || process.env.GOOGLE_MAPS_API_KEY || '',
    googleMapsMapId: maps.mapId || process.env.VITE_GOOGLE_MAPS_MAP_ID || '',
    activePaymentProvider: payment.provider || 'razorpay',
    paymentEnvironment: payment.environment || 'production'
  };
};

const computeStatus = ({ enabled, credentials, lastTestStatus, source, serviceKey, providerId }) => {
  if (enabled === false) return 'disabled';
  if (lastTestStatus === 'failed') return 'failed';
  if (lastTestStatus === 'success') return 'connected';
  const sensitiveFields = getProviderSensitiveFields(serviceKey, providerId);
  const publicFields = getProviderPublicFields(serviceKey, providerId);
  const creds = credentials || {};
  const hasRequired = sensitiveFields.some((f) => creds[f]) || publicFields.some((f) => creds[f]);
  if (source === 'env' && hasRequired) return 'connected';
  if (source === 'database' && hasRequired) return 'configured';
  return 'not_configured';
};

const buildProviderProfilesSummary = (serviceKey, dbDoc, envFallback) => {
  const profiles = { ...(envFallback?.configuration?.providerProfiles || {}), ...(dbDoc?.configuration?.providerProfiles || {}) };
  const summary = {};
  Object.keys(profiles).forEach((providerId) => {
    const pid = normalizeProviderId(serviceKey, providerId);
    const raw = profiles[providerId];
    const decrypted = decryptProviderCredentials(serviceKey, pid, raw);
    const masked = maskProviderCredentials(serviceKey, pid, decrypted);
    summary[pid] = {
      configured: Object.keys(decrypted).some((k) => decrypted[k]),
      credentials: masked,
      status: computeStatus({
        enabled: true,
        credentials: decrypted,
        source: dbDoc?.configuration?.providerProfiles?.[providerId] ? 'database' : 'env',
        serviceKey,
        providerId: pid
      })
    };
  });
  return summary;
};

const serializeIntegration = async (serviceName) => {
  const def = getDefinition(serviceName);
  if (!def) return null;

  const serviceKey = def.serviceKey;
  const dbDoc = await getDbConfig(serviceKey);
  const envFallback = getEnvFallback(serviceKey);
  const resolved = await resolveConfig(serviceKey);

  const activeProvider = resolveActiveProvider({
    provider: dbDoc?.provider || envFallback?.provider,
    configuration: { ...(envFallback?.configuration || {}), ...(dbDoc?.configuration || {}) }
  }, serviceKey);

  const profileSource = dbDoc?.configuration?.providerProfiles?.[activeProvider]
    || envFallback?.configuration?.providerProfiles?.[activeProvider]
    || dbDoc?.credentials
    || envFallback?.credentials
    || {};

  const displayCreds = typeof profileSource === 'object' && !Array.isArray(profileSource)
    ? decryptProviderCredentials(serviceKey, activeProvider, profileSource)
    : {};

  const maskedCreds = maskProviderCredentials(serviceKey, activeProvider, displayCreds);
  const status = computeStatus({
    serviceName: serviceKey,
    enabled: resolved?.enabled,
    credentials: displayCreds,
    lastTestStatus: dbDoc?.lastTestStatus,
    source: resolved?.source,
    serviceKey,
    providerId: activeProvider
  });

  return {
    serviceName: serviceKey,
    label: def.label,
    routeKey: def.routeKey,
    provider: activeProvider,
    activeProvider,
    providers: def.catalog.providers,
    enabled: resolved?.enabled !== false,
    environment: dbDoc?.environment || envFallback?.environment || 'production',
    isActive: dbDoc?.isActive !== false,
    credentials: maskedCreds,
    configuration: {
      ...(envFallback?.configuration || {}),
      ...(dbDoc?.configuration || {}),
      activeProvider
    },
    providerProfiles: buildProviderProfilesSummary(serviceKey, dbDoc, envFallback),
    status,
    source: resolved?.source || 'none',
    lastTestedAt: dbDoc?.lastTestedAt || null,
    lastTestStatus: dbDoc?.lastTestStatus || null,
    lastTestMessage: dbDoc?.lastTestMessage || '',
    updatedAt: dbDoc?.updatedAt || null,
    sensitiveFields: getProviderSensitiveFields(serviceKey, activeProvider),
    publicFields: getProviderPublicFields(serviceKey, activeProvider)
  };
};

const listIntegrations = async () => {
  const items = [];
  for (const serviceName of MANAGED_SERVICES) {
    const item = await serializeIntegration(serviceName);
    if (item) items.push(item);
  }
  const overview = {
    total: items.length,
    active: items.filter((i) => i.enabled && ['connected', 'configured'].includes(i.status)).length,
    inactive: items.filter((i) => !i.enabled || i.status === 'disabled').length,
    issues: items.filter((i) => i.status === 'failed' || i.status === 'not_configured').length
  };
  return { overview, integrations: items };
};

const getCatalog = () => getAllCatalogs();

const writeAuditLog = async ({ adminId, serviceName, provider, action, success, message, metadata = {} }) => {
  try {
    await IntegrationAuditLog.create({
      adminId,
      serviceName,
      provider,
      action,
      success,
      message: String(message || '').slice(0, 500),
      metadata
    });
  } catch (err) {
    console.error('[IntegrationConfig] Audit log failed:', err.message);
  }
};

const validatePayload = (serviceName, payload) => {
  const def = getDefinition(serviceName);
  if (!def) throw new Error('Unknown integration service.');
  const providerId = normalizeProviderId(def.serviceKey, payload.provider);
  if (providerId && !def.providers.includes(providerId)) {
    throw new Error(`Invalid provider for ${def.label}.`);
  }
  if (providerId) {
    assertActiveProvider(def.serviceKey, providerId);
  }
  if (payload.environment && !['test', 'production'].includes(payload.environment)) {
    throw new Error('Environment must be test or production.');
  }
};

const upsertIntegration = async (serviceName, payload, adminId) => {
  validatePayload(serviceName, payload);
  const def = getDefinition(serviceName);
  const serviceKey = def.serviceKey;
  const providerId = normalizeProviderId(serviceKey, payload.provider || payload.configuration?.activeProvider || def.defaultProvider);
  assertActiveProvider(serviceKey, providerId);

  const existing = await IntegrationConfig.findOne({ serviceName: serviceKey });
  const existingProfiles = existing?.configuration?.providerProfiles || {};
  const existingProviderCreds = existingProfiles[providerId]
    ? decryptProviderCredentials(serviceKey, providerId, existingProfiles[providerId])
    : (existing?.provider === providerId
      ? decryptProviderCredentials(serviceKey, providerId, existing.credentials || {})
      : {});

  const sensitiveFields = getProviderSensitiveFields(serviceKey, providerId);
  const mergedPlainCreds = mergeCredentials(
    existingProviderCreds,
    payload.credentials || {},
    sensitiveFields
  );
  const encryptedProfile = encryptProviderCredentials(serviceKey, providerId, mergedPlainCreds);

  const activeProvider = normalizeProviderId(
    serviceKey,
    payload.configuration?.activeProvider || existing?.configuration?.activeProvider || providerId
  );

  const configuration = {
    ...(existing?.configuration || {}),
    ...(payload.configuration || {}),
    activeProvider,
    providerProfiles: {
      ...existingProfiles,
      [providerId]: encryptedProfile
    }
  };

  const topLevelCredentials = activeProvider === providerId
    ? encryptedProfile
    : (existing?.credentials || encryptedProfile);

  const update = {
    serviceName: serviceKey,
    provider: activeProvider,
    enabled: payload.enabled !== undefined ? payload.enabled !== false : (existing?.enabled !== false),
    environment: payload.environment || existing?.environment || 'production',
    isActive: payload.isActive !== undefined ? payload.isActive !== false : (existing?.isActive !== false),
    credentials: topLevelCredentials,
    configuration,
    updatedBy: adminId
  };

  const doc = existing
    ? await IntegrationConfig.findOneAndUpdate({ serviceName: serviceKey }, update, { new: true })
    : await IntegrationConfig.create(update);

  invalidateCache(serviceKey);

  await writeAuditLog({
    adminId,
    serviceName: serviceKey,
    provider: providerId,
    action: existing ? 'update' : 'create',
    success: true,
    message: `${def.label} (${providerId}) configuration ${existing ? 'updated' : 'created'}.`
  });

  return serializeIntegration(serviceKey);
};

const setActiveProvider = async (serviceName, providerId, adminId) => {
  const def = getDefinition(serviceName);
  if (!def) throw new Error('Unknown integration service.');
  const serviceKey = def.serviceKey;
  const normalized = normalizeProviderId(serviceKey, providerId);
  assertActiveProvider(serviceKey, normalized);

  const existing = await IntegrationConfig.findOne({ serviceName: serviceKey });
  const envConfig = getEnvFallback(serviceKey);

  let configuration;
  let credentials;
  let enabled;
  let environment;

  if (existing) {
    configuration = {
      ...(existing.configuration || {}),
      activeProvider: normalized
    };
    const profiles = configuration.providerProfiles || {};
    credentials = profiles[normalized] || existing.credentials;
    enabled = existing.enabled !== false;
    environment = existing.environment || 'production';
  } else if (envConfig) {
    configuration = {
      ...(envConfig.configuration || {}),
      activeProvider: normalized
    };
    const profiles = configuration.providerProfiles || {};
    const plainProfile = profiles[normalized] || envConfig.credentials || {};
    credentials = encryptProviderCredentials(serviceKey, normalized, plainProfile);
    enabled = envConfig.enabled !== false;
    environment = envConfig.environment || 'production';
  } else {
    throw new Error('Integration not configured. Save provider credentials first.');
  }

  const doc = existing
    ? await IntegrationConfig.findOneAndUpdate(
      { serviceName: serviceKey },
      { provider: normalized, credentials, configuration, updatedBy: adminId },
      { new: true }
    )
    : await IntegrationConfig.create({
      serviceName: serviceKey,
      provider: normalized,
      enabled,
      environment,
      credentials,
      configuration,
      updatedBy: adminId
    });

  invalidateCache(serviceKey);

  await writeAuditLog({
    adminId,
    serviceName: serviceKey,
    provider: normalized,
    action: 'switch_provider',
    success: true,
    message: `Active provider switched to ${normalized}.`
  });

  return serializeIntegration(serviceKey);
};

const updateIntegrationStatus = async (serviceName, { enabled }, adminId) => {
  const serviceKey = resolveServiceKey(serviceName);
  const doc = await IntegrationConfig.findOne({ serviceName: serviceKey });
  if (!doc) {
    const envConfig = getEnvFallback(serviceKey);
    if (!envConfig) throw new Error('Integration not found.');
    const providerId = normalizeProviderId(serviceKey, envConfig.provider);
    await IntegrationConfig.create({
      serviceName: serviceKey,
      provider: providerId,
      enabled: enabled !== false,
      environment: envConfig.environment,
      credentials: encryptProviderCredentials(serviceKey, providerId, envConfig.credentials),
      configuration: envConfig.configuration,
      updatedBy: adminId
    });
  } else {
    doc.enabled = enabled !== false;
    doc.updatedBy = adminId;
    await doc.save();
  }
  invalidateCache(serviceKey);
  await writeAuditLog({
    adminId,
    serviceName: serviceKey,
    provider: doc?.provider,
    action: enabled ? 'enable' : 'disable',
    success: true,
    message: `Integration ${enabled ? 'enabled' : 'disabled'}.`
  });
  return serializeIntegration(serviceKey);
};

const recordTestResult = async (serviceName, { success, message }) => {
  const serviceKey = resolveServiceKey(serviceName);
  await IntegrationConfig.findOneAndUpdate(
    { serviceName: serviceKey },
    {
      lastTestedAt: new Date(),
      lastTestStatus: success ? 'success' : 'failed',
      lastTestMessage: String(message || '').slice(0, 500)
    },
    { upsert: false }
  );
  invalidateCache(serviceKey);
};

const testIntegration = async (serviceName, options = {}, adminId = null) => {
  const { testIntegrationConnection } = require('./integrationTestService');
  const serviceKey = resolveServiceKey(serviceName);
  let config;

  if (options.provider) {
    const providerId = normalizeProviderId(serviceKey, options.provider);
    if (options.credentials && Object.keys(options.credentials).length) {
      config = {
        serviceName: serviceKey,
        provider: providerId,
        environment: options.environment || 'production',
        credentials: options.credentials,
        configuration: options.configuration || {}
      };
    } else {
      config = await resolveConfig(serviceKey, { skipCache: true });
      if (config) config.provider = providerId;
    }
  } else {
    config = await resolveConfig(serviceKey, { skipCache: true });
  }

  if (!config) throw new Error('Integration is not configured.');

  let result;
  try {
    result = await testIntegrationConnection(serviceKey, config, options);
  } catch (err) {
    result = { success: false, message: err.message || 'Connection test failed.' };
  }

  if (adminId) {
    await recordTestResult(serviceKey, result);
    await writeAuditLog({
      adminId,
      serviceName: serviceKey,
      provider: config.provider,
      action: 'test',
      success: result.success,
      message: result.message
    });
  }

  return result;
};

// Legacy aliases for encrypt/decrypt used in tests
const encryptCredentials = (serviceName, credentials, providerId) =>
  encryptProviderCredentials(resolveServiceKey(serviceName), providerId || getDefinition(serviceName)?.defaultProvider, credentials);

const decryptCredentials = (serviceName, credentials, providerId) =>
  decryptProviderCredentials(resolveServiceKey(serviceName), providerId || getDefinition(serviceName)?.defaultProvider, credentials);

const maskCredentials = (serviceName, credentials, providerId) =>
  maskProviderCredentials(resolveServiceKey(serviceName), providerId || getDefinition(serviceName)?.defaultProvider, credentials);

module.exports = {
  SERVICE_NAMES,
  MANAGED_SERVICES,
  registerRefreshHook,
  invalidateCache,
  resolveConfig,
  resolveServiceKey,
  getDefinition,
  getCatalog,
  getPaymentGatewayCredentials,
  getSmsCredentials,
  getMapsCredentials,
  getFirebaseCredentials,
  getCloudinaryCredentials,
  getEmailCredentials,
  getPublicClientConfig,
  listIntegrations,
  serializeIntegration,
  upsertIntegration,
  setActiveProvider,
  updateIntegrationStatus,
  testIntegration,
  recordTestResult,
  maskCredentials,
  mergeCredentials,
  encryptCredentials,
  decryptCredentials,
  encryptProviderCredentials,
  decryptProviderCredentials,
  maskProviderCredentials
};
