zrequire('dotenv').config();
const { sendOTP } = require('./services/smsService');

async function test() {
  const phone = '9999999999'; // We should probably use a dummy number or ask user for their number, but let's just see the API response structure or authentication error.
  console.log('Testing SMS with API KEY:', process.env.SMS_INDIA_HUB_API_KEY);
  const res = await sendOTP(phone, '1234');
  console.log('Result:', res);
}

test();
