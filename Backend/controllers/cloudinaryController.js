const cloudinary = require('../config/cloudinary');
const { applyConfig } = require('../services/cloudinaryService');
const { getCloudinaryCredentials } = require('../services/integrationConfigService');

exports.getSignature = async (req, res) => {
  try {
    await applyConfig();
    const creds = await getCloudinaryCredentials();
    const { folder = creds.defaultFolder || 'appzeto' } = req.query;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, creds.apiSecret);

    res.status(200).json({
      success: true,
      signature,
      timestamp,
      cloudName: creds.cloudName,
      apiKey: creds.apiKey,
      folder
    });
  } catch (error) {
    console.error('Cloudinary signature error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate upload signature' });
  }
};
