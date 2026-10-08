require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Set environment to 'test' in integrationconfigs
  await db.collection('integrationconfigs').updateOne(
    { serviceName: 'payment_gateway' },
    { $set: { environment: 'test' } }
  );
  console.log('Updated payment_gateway environment to test');

  const { getClient, getCredentials } = require('../services/integrations/payment/paymentGatewayService');
  const creds = await getCredentials();
  const c = await getClient();
  console.log('RESOLVED CREDS NOW:', { keyId: creds.keyId, secret: creds.keySecret?.substring(0, 5) + '...', env: c.active?.environment });

  const axios = require('axios');
  const auth = Buffer.from(c.keyId + ':' + c.keySecret).toString('base64');
  try {
    const r = await axios.get('https://api.razorpay.com/v1/orders?count=1', {
      headers: { Authorization: 'Basic ' + auth }
    });
    console.log('✅ Razorpay SUCCESS status:', r.status);
  } catch (e) {
    console.log('❌ Razorpay ERROR:', e.response?.data);
  }

  // Now test createQRCode
  const { createQRCode } = require('../services/razorpayService');
  const qr = await createQRCode(1499, 'BKTEST1499');
  console.log('QR Code result:', qr);

  await mongoose.disconnect();
}

main().catch(console.error);
