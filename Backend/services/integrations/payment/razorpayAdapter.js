const Razorpay = require('razorpay');

const createClient = (keyId, keySecret) => {
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

const resolveKeys = (credentials = {}, environment = 'production') => {
  const env = environment === 'test' ? 'test' : 'production';
  const keyId = env === 'test'
    ? (credentials.testKeyId || '')
    : (credentials.liveKeyId || credentials.testKeyId || '');
  const keySecret = env === 'test'
    ? (credentials.testSecretKey || '')
    : (credentials.liveSecretKey || credentials.testSecretKey || '');
  return { keyId, keySecret };
};

const testConnection = async (credentials, environment = 'production') => {
  const { keyId, keySecret } = resolveKeys(credentials, environment);
  if (!keyId || !keySecret) {
    return { success: false, message: 'Configuration incomplete. Key ID and Secret Key are required.' };
  }
  const axios = require('axios');
  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await axios.get('https://api.razorpay.com/v1/orders?count=1', {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 15000
    });
    if (response.status === 200) {
      return { success: true, message: `Razorpay connection successful (${environment} mode).` };
    }
    return { success: false, message: 'Unexpected response from Razorpay.' };
  } catch (error) {
    if (error.response?.status === 401) return { success: false, message: 'Invalid credentials.' };
    return { success: false, message: 'Provider unavailable.' };
  }
};

module.exports = {
  providerId: 'razorpay',
  createClient,
  resolveKeys,
  testConnection
};
