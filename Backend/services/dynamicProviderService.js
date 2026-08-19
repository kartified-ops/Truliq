/**
 * Dynamic Provider Service
 *
 * CRUD for ThirdPartyProvider model + runtime resolution of the active
 * provider for a given serviceType. Handles encryption, masking, validation,
 * activation (only one active per service), and connection testing.
 */
const ThirdPartyProvider = require('../models/ThirdPartyProvider');
const IntegrationAuditLog = require('../models/IntegrationAuditLog');
const { encryptSecret, decryptSecret, isEncryptedValue, maskSecret } = require('../utils/credentialEncryption');
const { executeProvider, executeSms } = require('./genericIntegrationEngine');

// ── Credential encryption/decryption ─────────────────────────────────────
const CREDENTIAL_FIELDS = ['apiKey', 'apiSecret', 'password', 'bearerToken', 'secretKey', 'authToken'];

const encryptCredentials = (credentials = {}) => {
  const encrypted = { ...credentials };
  CREDENTIAL_FIELDS.forEach((field) => {
    if (encrypted[field] && !isEncryptedValue(encrypted[field])) {
      encrypted[field] = encryptSecret(encrypted[field]);
    }
  });
  // Encrypt any field ending with 'Secret', 'Token', 'Password'
  Object.keys(encrypted).forEach((key) => {
    if ((key.endsWith('Secret') || key.endsWith('Token') || key.endsWith('Password'))
      && encrypted[key] && !isEncryptedValue(encrypted[key])) {
      encrypted[key] = encryptSecret(encrypted[key]);
    }
  });
  return encrypted;
};

const decryptCredentials = (credentials = {}) => {
  const decrypted = {};
  Object.entries(credentials).forEach(([key, value]) => {
    if (typeof value === 'string' && isEncryptedValue(value)) {
      try { decrypted[key] = decryptSecret(value); } catch (_) { decrypted[key] = ''; }
    } else {
      decrypted[key] = value;
    }
  });
  return decrypted;
};

const maskCredentials = (credentials = {}) => {
  const masked = {};
  Object.entries(credentials).forEach(([key, value]) => {
    if (typeof value === 'string' && isEncryptedValue(value)) {
      masked[key] = maskSecret('********');
      masked[`${key}Configured`] = true;
    } else if (typeof value === 'string' && CREDENTIAL_FIELDS.includes(key)) {
      masked[key] = maskSecret(value);
      masked[`${key}Configured`] = true;
    } else if (typeof value === 'string'
      && (key.endsWith('Secret') || key.endsWith('Token') || key.endsWith('Password'))) {
      masked[key] = maskSecret(value);
      masked[`${key}Configured`] = true;
    } else {
      masked[key] = value;
    }
  });
  return masked;
};

// Also mask header values marked as secret
const maskHeaders = (headers = []) => {
  return headers.map((h) => ({
    key: h.key,
    value: h.isSecret ? maskSecret(h.value || '') : h.value,
    isSecret: h.isSecret
  }));
};

const maskQueryParams = (params = []) => {
  return params.map((p) => ({
    key: p.key,
    value: p.isSecret ? maskSecret(p.value || '') : p.value,
    isSecret: p.isSecret
  }));
};

// ── Encrypt headers/queryparams that are marked secret ───────────────────
const encryptHeaders = (headers = []) => {
  return headers.map((h) => ({
    key: h.key,
    value: h.isSecret && h.value && !isEncryptedValue(h.value) ? encryptSecret(h.value) : h.value,
    isSecret: h.isSecret
  }));
};

const encryptQueryParams = (params = []) => {
  return params.map((p) => ({
    key: p.key,
    value: p.isSecret && p.value && !isEncryptedValue(p.value) ? encryptSecret(p.value) : p.value,
    isSecret: p.isSecret
  }));
};

// ── Slug generation ──────────────────────────────────────────────────────
const generateSlug = (name) => {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
};

// ── Serialize for frontend ───────────────────────────────────────────────
const serializeProvider = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  return {
    _id: obj._id,
    serviceType: obj.serviceType,
    providerName: obj.providerName,
    providerSlug: obj.providerSlug,
    enabled: obj.enabled,
    isActive: obj.isActive,
    environment: obj.environment,
    useGenericEngine: obj.useGenericEngine,
    adapterKey: obj.adapterKey,
    apiUrl: obj.apiUrl,
    httpMethod: obj.httpMethod,
    authenticationType: obj.authenticationType,
    credentials: maskCredentials(obj.credentials || {}),
    headers: maskHeaders(obj.headers || []),
    queryParams: maskQueryParams(obj.queryParams || []),
    requestBodyTemplate: obj.requestBodyTemplate,
    contentType: obj.contentType,
    responseSuccessPath: obj.responseSuccessPath,
    responseSuccessValue: obj.responseSuccessValue,
    responseMessagePath: obj.responseMessagePath,
    variableMapping: obj.variableMapping,
    configuration: obj.configuration,
    lastTestedAt: obj.lastTestedAt,
    lastTestStatus: obj.lastTestStatus,
    lastTestMessage: obj.lastTestMessage,
    createdBy: obj.createdBy,
    updatedBy: obj.updatedBy,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

// ── CRUD ─────────────────────────────────────────────────────────────────
const listProviders = async (serviceType = null) => {
  const query = serviceType ? { serviceType } : {};
  const docs = await ThirdPartyProvider.find(query).sort({ isActive: -1, updatedAt: -1 }).lean();
  return docs.map((d) => serializeProvider(d));
};

const getProvider = async (id) => {
  const doc = await ThirdPartyProvider.findById(id);
  return doc ? serializeProvider(doc) : null;
};

const getActiveProvider = async (serviceType) => {
  return ThirdPartyProvider.findOne({ serviceType, isActive: true, enabled: true }).lean();
};

const createProvider = async (data, adminId) => {
  const slug = generateSlug(data.providerName);
  const existing = await ThirdPartyProvider.findOne({ serviceType: data.serviceType, providerSlug: slug });
  if (existing) {
    throw new Error(`A provider named "${data.providerName}" already exists for this service.`);
  }

  const doc = await ThirdPartyProvider.create({
    serviceType: data.serviceType,
    providerName: data.providerName,
    providerSlug: slug,
    enabled: data.enabled !== false,
    isActive: false,
    environment: data.environment || 'production',
    useGenericEngine: data.useGenericEngine !== false,
    adapterKey: data.adapterKey || null,
    apiUrl: data.apiUrl || '',
    httpMethod: data.httpMethod || 'POST',
    authenticationType: data.authenticationType || 'api_key',
    credentials: encryptCredentials(data.credentials || {}),
    headers: encryptHeaders(data.headers || []),
    queryParams: encryptQueryParams(data.queryParams || []),
    requestBodyTemplate: data.requestBodyTemplate || '',
    contentType: data.contentType || 'application/json',
    responseSuccessPath: data.responseSuccessPath || '',
    responseSuccessValue: data.responseSuccessValue || '',
    responseMessagePath: data.responseMessagePath || '',
    variableMapping: data.variableMapping || {},
    configuration: data.configuration || {},
    createdBy: adminId,
    updatedBy: adminId
  });

  await writeAudit(adminId, doc.serviceType, doc.providerName, 'create', true, 'Provider created.');
  return serializeProvider(doc);
};

const updateProvider = async (id, data, adminId) => {
  const doc = await ThirdPartyProvider.findById(id);
  if (!doc) throw new Error('Provider not found.');

  // Merge credentials — empty secret fields keep existing
  if (data.credentials) {
    const existingDecrypted = decryptCredentials(doc.credentials || {});
    const incoming = data.credentials;
    const merged = { ...existingDecrypted };
    Object.entries(incoming).forEach(([k, v]) => {
      if (v === '' && (CREDENTIAL_FIELDS.includes(k) || k.endsWith('Secret') || k.endsWith('Token') || k.endsWith('Password'))) return;
      if (v === undefined || v === null) return;
      merged[k] = v;
    });
    doc.credentials = encryptCredentials(merged);
  }

  if (data.providerName !== undefined) {
    doc.providerName = data.providerName;
    doc.providerSlug = generateSlug(data.providerName);
  }
  if (data.enabled !== undefined) doc.enabled = data.enabled;
  if (data.environment !== undefined) doc.environment = data.environment;
  if (data.useGenericEngine !== undefined) doc.useGenericEngine = data.useGenericEngine;
  if (data.adapterKey !== undefined) doc.adapterKey = data.adapterKey;
  if (data.apiUrl !== undefined) doc.apiUrl = data.apiUrl;
  if (data.httpMethod !== undefined) doc.httpMethod = data.httpMethod;
  if (data.authenticationType !== undefined) doc.authenticationType = data.authenticationType;
  if (data.headers !== undefined) doc.headers = encryptHeaders(data.headers);
  if (data.queryParams !== undefined) doc.queryParams = encryptQueryParams(data.queryParams);
  if (data.requestBodyTemplate !== undefined) doc.requestBodyTemplate = data.requestBodyTemplate;
  if (data.contentType !== undefined) doc.contentType = data.contentType;
  if (data.responseSuccessPath !== undefined) doc.responseSuccessPath = data.responseSuccessPath;
  if (data.responseSuccessValue !== undefined) doc.responseSuccessValue = data.responseSuccessValue;
  if (data.responseMessagePath !== undefined) doc.responseMessagePath = data.responseMessagePath;
  if (data.variableMapping !== undefined) doc.variableMapping = data.variableMapping;
  if (data.configuration !== undefined) doc.configuration = { ...doc.configuration, ...data.configuration };

  doc.updatedBy = adminId;
  await doc.save();

  await writeAudit(adminId, doc.serviceType, doc.providerName, 'update', true, 'Provider updated.');
  return serializeProvider(doc);
};

const activateProvider = async (id, adminId) => {
  const doc = await ThirdPartyProvider.findById(id);
  if (!doc) throw new Error('Provider not found.');
  if (!doc.enabled) throw new Error('Cannot activate a disabled provider. Enable it first.');

  // Deactivate all other providers for this service type
  await ThirdPartyProvider.updateMany(
    { serviceType: doc.serviceType, _id: { $ne: doc._id } },
    { isActive: false }
  );

  doc.isActive = true;
  doc.updatedBy = adminId;
  await doc.save();

  // Invalidate integration config cache for this service
  try {
    const { invalidateCache } = require('./integrationConfigService');
    invalidateCache(doc.serviceType);
  } catch (_) { /* optional */ }

  await writeAudit(adminId, doc.serviceType, doc.providerName, 'activate', true, `${doc.providerName} activated.`);
  return serializeProvider(doc);
};

const deactivateProvider = async (id, adminId) => {
  const doc = await ThirdPartyProvider.findById(id);
  if (!doc) throw new Error('Provider not found.');
  doc.isActive = false;
  doc.updatedBy = adminId;
  await doc.save();

  await writeAudit(adminId, doc.serviceType, doc.providerName, 'deactivate', true, `${doc.providerName} deactivated.`);
  return serializeProvider(doc);
};

const deleteProvider = async (id, adminId) => {
  const doc = await ThirdPartyProvider.findById(id);
  if (!doc) throw new Error('Provider not found.');
  if (doc.isActive) throw new Error('Cannot delete an active provider. Deactivate it first.');

  const name = doc.providerName;
  const serviceType = doc.serviceType;
  await doc.deleteOne();

  await writeAudit(adminId, serviceType, name, 'delete', true, `${name} deleted.`);
  return { deleted: true };
};

// ── Test connection ──────────────────────────────────────────────────────
const testProvider = async (id, testParams = {}, adminId = null) => {
  const doc = await ThirdPartyProvider.findById(id);
  if (!doc) throw new Error('Provider not found.');

  let result;
  if (doc.useGenericEngine) {
    // For SMS: use executeSms helper
    if (doc.serviceType === 'sms' && testParams.testPhone) {
      result = await executeSms(doc, testParams.testPhone, testParams.testMessage || 'Truliq integration test. Please ignore.');
    } else {
      result = await executeProvider(doc, testParams, { includeResponse: true });
    }
  } else {
    // Adapter-based providers tested via integrationTestService
    try {
      const { testIntegration } = require('./integrationConfigService');
      result = await testIntegration(doc.serviceType, testParams);
    } catch (err) {
      result = { success: false, message: err.message };
    }
  }

  doc.lastTestedAt = new Date();
  doc.lastTestStatus = result.success ? 'success' : 'failed';
  doc.lastTestMessage = String(result.message || '').slice(0, 500);
  await doc.save();

  if (adminId) {
    await writeAudit(adminId, doc.serviceType, doc.providerName, 'test', result.success, result.message);
  }

  return result;
};

// ── Test unsaved configuration (before creating) ─────────────────────────
const testUnsavedProvider = async (data, testParams = {}) => {
  const provider = {
    apiUrl: data.apiUrl,
    httpMethod: data.httpMethod || 'POST',
    authenticationType: data.authenticationType || 'api_key',
    credentials: data.credentials || {},
    headers: data.headers || [],
    queryParams: data.queryParams || [],
    requestBodyTemplate: data.requestBodyTemplate || '',
    contentType: data.contentType || 'application/json',
    responseSuccessPath: data.responseSuccessPath || '',
    responseSuccessValue: data.responseSuccessValue || '',
    responseMessagePath: data.responseMessagePath || '',
    variableMapping: data.variableMapping || {},
    configuration: data.configuration || {}
  };

  if (data.serviceType === 'sms' && testParams.testPhone) {
    return executeSms(provider, testParams.testPhone, testParams.testMessage || 'Truliq integration test.');
  }
  return executeProvider(provider, testParams, { includeResponse: true });
};

// ── Runtime: get active provider for a service ───────────────────────────
const resolveActiveProvider = async (serviceType) => {
  const doc = await ThirdPartyProvider.findOne({ serviceType, isActive: true, enabled: true }).lean();
  return doc || null;
};

// ── Audit ────────────────────────────────────────────────────────────────
const writeAudit = async (adminId, serviceName, provider, action, success, message) => {
  try {
    await IntegrationAuditLog.create({
      adminId,
      serviceName,
      provider,
      action,
      success,
      message: String(message || '').slice(0, 500)
    });
  } catch (_) { /* non-critical */ }
};

module.exports = {
  listProviders,
  getProvider,
  getActiveProvider,
  createProvider,
  updateProvider,
  activateProvider,
  deactivateProvider,
  deleteProvider,
  testProvider,
  testUnsavedProvider,
  resolveActiveProvider,
  decryptCredentials,
  serializeProvider
};
