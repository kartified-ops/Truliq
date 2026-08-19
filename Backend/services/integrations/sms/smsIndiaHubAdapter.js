const axios = require('axios');

const sendSms = async (credentials, phone, message) => {
  const apiUrl = credentials.apiUrl || 'https://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
  const params = {
    APIKey: credentials.apiKey,
    msisdn: phone,
    sid: credentials.senderId,
    msg: message,
    fl: 0,
    gwid: 2
  };
  if (credentials.dltTemplateId) params.TemplateId = credentials.dltTemplateId;

  const response = await axios.get(apiUrl, { params, timeout: 20000 });
  const data = response.data;
  const ok = (typeof data === 'object' && (data.ErrorCode === '000' || data.ErrorMessage === 'Done' || data.ErrorMessage === 'Success'))
    || (typeof data === 'string' && data.startsWith('Success'));
  return { success: ok, data: response.data };
};

const testConnection = async (credentials, options = {}) => {
  if (!credentials.apiKey || !credentials.senderId) {
    return { success: false, message: 'Configuration incomplete. API Key and Sender ID are required.' };
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
  providerId: 'sms_india_hub',
  sendSms,
  testConnection
};
