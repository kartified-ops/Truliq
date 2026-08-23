const { sendSms, getSmsCredentials } = require('./integrations/sms/smsGatewayService');

const sendSMS = async (phone, message) => sendSms(phone, message);

const sendOTP = async (phone, otp) => {
  const appName = 'Truliq';
  const message = `Welcome to the ${appName} powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`;
  return sendSms(phone, message);
};

module.exports = {
  sendSMS,
  sendOTP,
  getSmsCredentials
};

