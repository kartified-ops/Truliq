const axios = require('axios');
const nodemailer = require('nodemailer');
const { SERVICE_KEYS } = require('../config/integrationProviders');
const { SERVICE_NAMES } = require('./integrationConfigService');
const { testProvider: testPaymentProvider } = require('./integrations/payment/paymentGatewayService');
const { testProvider: testSmsProvider } = require('./integrations/sms/smsGatewayService');

const testMaps = async (config) => {
  const apiKey = config.credentials?.apiKey;
  if (!apiKey) return { success: false, message: 'Configuration incomplete. API Key is required.' };

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address: 'New Delhi, India', key: apiKey },
      timeout: 15000
    });
    if (response.data.status === 'OK') {
      return { success: true, message: 'Maps API connection successful.' };
    }
    if (response.data.status === 'REQUEST_DENIED') {
      return { success: false, message: 'Invalid API key or API not enabled.' };
    }
    return { success: false, message: `Maps API error: ${response.data.status}` };
  } catch (error) {
    return { success: false, message: 'Maps provider unavailable.' };
  }
};

const testFirebase = async (config, options = {}) => {
  let serviceAccount = null;
  const raw = config.credentials?.serviceAccountJson;
  if (!raw) return { success: false, message: 'Configuration incomplete. Service account JSON is required.' };

  try {
    serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {
    return { success: false, message: 'Invalid Firebase service account JSON.' };
  }

  try {
    const admin = require('firebase-admin');
    const appName = `integration-test-${Date.now()}`;
    const testApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: config.configuration?.databaseUrl || undefined
    }, appName);

    if (options.testToken) {
      await testApp.messaging().send({
        token: options.testToken,
        notification: {
          title: 'Truliq Integration Test',
          body: 'Firebase push configuration is working.'
        }
      }, true);
    } else {
      await testApp.messaging().sendEachForMulticast({
        tokens: ['invalid-token-for-dry-run'],
        notification: { title: 'test', body: 'test' }
      });
    }

    await testApp.delete();
    return { success: true, message: options.testToken ? 'Test notification sent.' : 'Firebase credentials validated.' };
  } catch (error) {
    if (error.code === 'app/duplicate-app') {
      return { success: true, message: 'Firebase credentials validated.' };
    }
    if (error.code === 'messaging/invalid-argument' || error.code === 'messaging/registration-token-not-registered') {
      return { success: true, message: 'Firebase credentials validated (FCM reachable).' };
    }
    return { success: false, message: 'Invalid Firebase credentials or project configuration.' };
  }
};

const testCloudinary = async (config) => {
  const { cloudName, apiKey, apiSecret } = config.credentials || {};
  if (!cloudName || !apiKey || !apiSecret) {
    return { success: false, message: 'Configuration incomplete. Cloud name, API key, and secret are required.' };
  }

  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    await cloudinary.api.ping();
    return { success: true, message: 'Cloudinary connection successful.' };
  } catch (error) {
    return { success: false, message: 'Invalid Cloudinary credentials.' };
  }
};

const testEmail = async (config, options = {}) => {
  const creds = config.credentials || {};
  if (!creds.user || !creds.password) {
    return { success: false, message: 'Configuration incomplete. SMTP user and password are required.' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: creds.host || 'smtp.gmail.com',
      port: parseInt(creds.port, 10) || 587,
      secure: creds.encryption === 'ssl',
      auth: { user: creds.user, pass: creds.password }
    });
    await transporter.verify();
    if (options.testEmail) {
      await transporter.sendMail({
        from: creds.from || creds.user,
        to: options.testEmail,
        subject: 'Truliq SMTP Integration Test',
        text: 'Your SMTP integration is configured correctly.'
      });
      return { success: true, message: 'Test email sent successfully.' };
    }
    return { success: true, message: 'SMTP connection successful.' };
  } catch (error) {
    return { success: false, message: 'SMTP connection failed. Check host, port, and credentials.' };
  }
};

const testIntegrationConnection = async (serviceName, config, options = {}) => {
  const providerId = options.provider || config.provider;

  switch (serviceName) {
    case SERVICE_NAMES.PAYMENT_GATEWAY:
    case SERVICE_KEYS.PAYMENT_GATEWAY:
      return testPaymentProvider(providerId || 'razorpay', config.credentials, config.environment);
    case SERVICE_NAMES.SMS:
    case SERVICE_KEYS.SMS:
      return testSmsProvider(providerId || 'sms_india_hub', config.credentials, options);
    case SERVICE_NAMES.MAPS:
    case SERVICE_KEYS.MAPS:
      return testMaps(config);
    case SERVICE_NAMES.FIREBASE:
    case SERVICE_KEYS.FIREBASE:
    case SERVICE_NAMES.NOTIFICATION_CHANNEL:
    case SERVICE_KEYS.NOTIFICATION_CHANNEL:
      return testFirebase(config, options);
    case SERVICE_NAMES.STORAGE:
    case SERVICE_NAMES.CLOUDINARY:
    case SERVICE_KEYS.STORAGE:
      return testCloudinary(config);
    case SERVICE_NAMES.EMAIL:
    case SERVICE_KEYS.EMAIL:
      return testEmail(config, options);
    default:
      return { success: false, message: 'Unsupported integration.' };
  }
};

module.exports = {
  testIntegrationConnection
};
