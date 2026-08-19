const { sendSms, getSmsCredentials } = require('./integrations/sms/smsGatewayService');

const sendSMS = async (phone, message) => sendSms(phone, message);

module.exports = {
  sendSMS,
  getSmsCredentials
};
