const axios = require('axios');

const sendSms = async (credentials, phone, message) => {
  const apiUrl = String(credentials.apiUrl || '').trim();
  if (!apiUrl) {
    return { success: false, message: 'API URL is required for this SMS provider.' };
  }

  const params = {
    APIKey: credentials.apiKey,
    api_key: credentials.apiKey,
    apikey: credentials.apiKey,
    msisdn: phone,
    mobile: phone,
    phone,
    numbers: phone,
    sid: credentials.senderId,
    sender: credentials.senderId,
    sender_id: credentials.senderId,
    msg: message,
    message,
    text: message,
    fl: 0,
    gwid: 2
  };
  if (credentials.dltTemplateId) {
    params.TemplateId = credentials.dltTemplateId;
    params.template_id = credentials.dltTemplateId;
  }

  const response = await axios({
    method: 'get',
    url: apiUrl,
    params,
    timeout: 20000,
    validateStatus: () => true
  });

  const data = response.data;
  const ok = response.status >= 200 && response.status < 300
    && !(typeof data === 'object' && (data.ErrorCode && data.ErrorCode !== '000' && data.error));
  return { success: ok, data };
};

const testConnection = async (credentials, options = {}) => {
  if (!credentials.apiKey) {
    return { success: false, message: 'API Key is required.' };
  }
  if (!credentials.apiUrl) {
    return { success: false, message: 'API URL is required.' };
  }
  const phone = String(options.testPhone || '').replace(/\D/g, '').slice(-10);
  if (!phone || phone.length !== 10) {
    return { success: false, message: 'Provide a valid 10-digit test phone number.' };
  }
  try {
    const result = await sendSms(credentials, phone, 'Truliq SMS integration test. Please ignore.');
    if (result.success) return { success: true, message: 'Test SMS sent successfully.' };
    return { success: false, message: 'SMS provider rejected the request.' };
  } catch (_) {
    return { success: false, message: 'SMS provider unavailable.' };
  }
};

module.exports = {
  providerId: 'generic_http',
  sendSms,
  testConnection
};
