const axios = require('axios');

const sendSms = async (credentials, phone, message) => {
  const accountSid = credentials.accountSid;
  const authToken = credentials.authToken;
  const from = credentials.phoneNumber;
  if (!accountSid || !authToken || !from) {
    return { success: false, message: 'Twilio Account SID, Auth Token, and Phone Number are required.' };
  }

  const to = String(phone).startsWith('+') ? phone : `+91${String(phone).replace(/\D/g, '').slice(-10)}`;
  const body = new URLSearchParams({ To: to, From: from, Body: message });
  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    body.toString(),
    {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
      validateStatus: () => true
    }
  );
  const ok = response.status >= 200 && response.status < 300;
  return { success: ok, data: response.data };
};

const testConnection = async (credentials, options = {}) => {
  const phone = String(options.testPhone || '').replace(/\D/g, '').slice(-10);
  if (!phone) return { success: false, message: 'Provide a valid test phone number.' };
  try {
    const result = await sendSms(credentials, phone, 'Truliq SMS integration test. Please ignore.');
    if (result.success) return { success: true, message: 'Test SMS sent successfully.' };
    return { success: false, message: result.data?.message || 'Twilio rejected the request.' };
  } catch (_) {
    return { success: false, message: 'Twilio unavailable.' };
  }
};

module.exports = {
  providerId: 'twilio',
  sendSms,
  testConnection
};
