/**
 * Generic HTTP Integration Engine
 *
 * Executes third-party API calls based on database-stored configuration.
 * Supports template variables, multiple auth types, and response validation.
 *
 * SECURITY:
 * - No eval() or Function() — only safe string interpolation
 * - Blocks requests to private IPs, localhost, cloud metadata
 * - Only HTTPS in production
 * - Template variables are whitelisted per service type
 */
const axios = require('axios');
const { URL } = require('url');
const { decryptSecret, isEncryptedValue } = require('../utils/credentialEncryption');

// ── Blocked hosts / IPs for SSRF protection ──────────────────────────────
const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  'metadata.google.internal', '169.254.169.254'
]);

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^fc00:/,
  /^fd/,
  /^fe80:/
];

const isBlockedUrl = (urlStr) => {
  try {
    const parsed = new URL(urlStr);
    if (BLOCKED_HOSTS.has(parsed.hostname)) return true;
    if (PRIVATE_RANGES.some((r) => r.test(parsed.hostname))) return true;
    if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') return true;
    return false;
  } catch (_) {
    return true;
  }
};

// ── Template variable interpolation ──────────────────────────────────────
const ALLOWED_VARIABLES = new Set([
  'phone', 'message', 'otp', 'senderId', 'templateId',
  'apiKey', 'apiSecret', 'username', 'password', 'bearerToken',
  'email', 'subject', 'body', 'from', 'fromName',
  'address', 'lat', 'lng', 'origin', 'destination',
  'amount', 'currency', 'orderId', 'receipt',
  'token', 'deviceToken', 'title', 'notificationBody',
  'cloudName', 'fileName', 'folder',
  'custom1', 'custom2', 'custom3', 'custom4', 'custom5'
]);

const interpolate = (template, variables) => {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!ALLOWED_VARIABLES.has(key)) return match;
    const val = variables[key];
    return val !== undefined && val !== null ? String(val) : '';
  });
};

const interpolateObject = (obj, variables) => {
  if (!obj) return obj;
  if (typeof obj === 'string') return interpolate(obj, variables);
  if (Array.isArray(obj)) return obj.map((item) => interpolateObject(item, variables));
  if (typeof obj === 'object') {
    const result = {};
    Object.entries(obj).forEach(([key, value]) => {
      result[key] = interpolateObject(value, variables);
    });
    return result;
  }
  return obj;
};

// ── Decrypt credentials from provider config ─────────────────────────────
const decryptProviderCredentials = (credentials = {}) => {
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

// ── Build variable context from provider config + runtime params ─────────
const buildVariables = (provider, runtimeParams = {}) => {
  const creds = decryptProviderCredentials(provider.credentials || {});
  return {
    ...creds,
    ...(provider.variableMapping || {}),
    ...(provider.configuration || {}),
    ...runtimeParams
  };
};

// ── Build headers ────────────────────────────────────────────────────────
const buildHeaders = (provider, variables) => {
  const headers = {};

  // Content-Type
  if (provider.contentType) {
    headers['Content-Type'] = provider.contentType;
  }

  // Auth-based headers
  switch (provider.authenticationType) {
    case 'bearer_token':
      if (variables.bearerToken || variables.apiKey) {
        headers['Authorization'] = `Bearer ${variables.bearerToken || variables.apiKey}`;
      }
      break;
    case 'basic_auth':
      if (variables.username && variables.password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${variables.username}:${variables.password}`).toString('base64')}`;
      }
      break;
    case 'header':
    case 'api_key':
      // Will be handled by custom headers below
      break;
    default:
      break;
  }

  // Custom headers from config
  (provider.headers || []).forEach((h) => {
    const key = h.key?.trim();
    if (!key) return;
    headers[key] = interpolate(h.value || '', variables);
  });

  return headers;
};

// ── Build query parameters ───────────────────────────────────────────────
const buildQueryParams = (provider, variables) => {
  const params = {};
  (provider.queryParams || []).forEach((qp) => {
    const key = qp.key?.trim();
    if (!key) return;
    params[key] = interpolate(qp.value || '', variables);
  });
  return params;
};

// ── Build request body ───────────────────────────────────────────────────
const buildRequestBody = (provider, variables) => {
  const template = provider.requestBodyTemplate;
  if (!template) return undefined;

  const interpolated = interpolate(template, variables);

  if (provider.contentType === 'application/json') {
    try {
      return JSON.parse(interpolated);
    } catch (_) {
      return interpolated;
    }
  }

  if (provider.contentType === 'application/x-www-form-urlencoded') {
    try {
      const parsed = JSON.parse(interpolated);
      return new URLSearchParams(parsed).toString();
    } catch (_) {
      return interpolated;
    }
  }

  return interpolated;
};

// ── Parse response success ───────────────────────────────────────────────
const getNestedValue = (obj, path) => {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((current, key) => {
    if (current === undefined || current === null) return undefined;
    return current[key];
  }, obj);
};

const evaluateResponse = (responseData, statusCode, provider) => {
  const successPath = provider.responseSuccessPath?.trim();
  const successValue = provider.responseSuccessValue?.trim();

  // If no response config, rely on HTTP status
  if (!successPath && !successValue) {
    return { success: statusCode >= 200 && statusCode < 300 };
  }

  // Special case: check HTTP status code
  if (successPath === 'statusCode' || successPath === 'status_code') {
    return { success: String(statusCode) === successValue };
  }

  const actualValue = getNestedValue(responseData, successPath);
  if (actualValue === undefined) {
    return { success: statusCode >= 200 && statusCode < 300 };
  }

  const matches = String(actualValue).toLowerCase() === successValue.toLowerCase();
  return { success: matches };
};

const extractMessage = (responseData, provider) => {
  const msgPath = provider.responseMessagePath?.trim();
  if (!msgPath) return '';
  return String(getNestedValue(responseData, msgPath) || '');
};

// ══════════════════════════════════════════════════════════════════════════
// Main execution function
// ══════════════════════════════════════════════════════════════════════════
const executeProvider = async (provider, runtimeParams = {}, options = {}) => {
  const apiUrl = provider.apiUrl?.trim();
  if (!apiUrl) {
    return { success: false, message: 'API URL is not configured.' };
  }

  if (isBlockedUrl(apiUrl)) {
    return { success: false, message: 'API URL is blocked for security reasons.' };
  }

  const variables = buildVariables(provider, runtimeParams);
  const headers = buildHeaders(provider, variables);
  const params = buildQueryParams(provider, variables);
  const body = buildRequestBody(provider, variables);
  const method = (provider.httpMethod || 'POST').toLowerCase();
  const timeout = options.timeout || 30000;

  // Interpolate URL (may contain {{variables}})
  const finalUrl = interpolate(apiUrl, variables);

  if (isBlockedUrl(finalUrl)) {
    return { success: false, message: 'Resolved API URL is blocked for security reasons.' };
  }

  try {
    const axiosConfig = {
      method,
      url: finalUrl,
      headers,
      params: Object.keys(params).length ? params : undefined,
      timeout,
      validateStatus: () => true
    };

    if (['post', 'put', 'patch'].includes(method) && body !== undefined) {
      axiosConfig.data = body;
    }

    const response = await axios(axiosConfig);
    const { success } = evaluateResponse(response.data, response.status, provider);
    const message = extractMessage(response.data, provider)
      || (success ? 'Request successful.' : `Request failed (HTTP ${response.status}).`);

    return {
      success,
      message,
      statusCode: response.status,
      responsePreview: options.includeResponse
        ? JSON.stringify(response.data).slice(0, 500)
        : undefined
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return { success: false, message: 'Request timed out.' };
    }
    if (error.code === 'ENOTFOUND') {
      return { success: false, message: 'DNS lookup failed. Check API URL.' };
    }
    return { success: false, message: error.message || 'Request failed.' };
  }
};

// ── Convenience: execute SMS via generic engine ──────────────────────────
const executeSms = async (provider, phone, message, otp = null) => {
  const runtimeParams = { phone, message };
  if (otp) runtimeParams.otp = otp;

  // Apply OTP template if configured
  if (otp && provider.configuration?.otpTemplate) {
    runtimeParams.message = interpolate(provider.configuration.otpTemplate, { otp, phone });
  }

  // Apply sender ID from config
  if (provider.configuration?.senderId) {
    runtimeParams.senderId = provider.configuration.senderId;
  }
  if (provider.configuration?.templateId) {
    runtimeParams.templateId = provider.configuration.templateId;
  }

  return executeProvider(provider, runtimeParams);
};

module.exports = {
  executeProvider,
  executeSms,
  interpolate,
  buildVariables,
  isBlockedUrl,
  ALLOWED_VARIABLES
};
