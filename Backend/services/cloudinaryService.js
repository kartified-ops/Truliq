const cloudinary = require('cloudinary').v2;
const {
  getCloudinaryCredentials,
  registerRefreshHook
} = require('./integrationConfigService');

let cachedFingerprint = '';

const applyConfig = async () => {
  const creds = await getCloudinaryCredentials();
  const fingerprint = `${creds.cloudName}:${creds.apiKey}:${creds.apiSecret?.length || 0}`;
  if (fingerprint === cachedFingerprint) return creds;
  if (creds.cloudName && creds.apiKey && creds.apiSecret) {
    cloudinary.config({
      cloud_name: creds.cloudName,
      api_key: creds.apiKey,
      api_secret: creds.apiSecret
    });
    cachedFingerprint = fingerprint;
  }
  return creds;
};

registerRefreshHook(() => {
  cachedFingerprint = '';
});

const uploadFile = async (file, options = {}) => {
  try {
    await applyConfig();
    const {
      folder = 'appzeto',
      resource_type = 'auto',
      transformation = [],
      public_id,
      ...restOptions
    } = options;

    let mimeType = 'image/png';
    if (public_id) {
      const ext = public_id.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'webp') mimeType = 'image/webp';
    }

    const uploadOptions = { folder, resource_type, transformation, ...restOptions };
    if (public_id) uploadOptions.public_id = public_id;

    let result;
    if (Buffer.isBuffer(file)) {
      const dataUri = `data:${mimeType};base64,${file.toString('base64')}`;
      result = await cloudinary.uploader.upload(dataUri, uploadOptions);
    } else {
      result = await cloudinary.uploader.upload(file, uploadOptions);
    }

    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error.message);
    return { success: false, error: error.message || 'Unknown error' };
  }
};

const deleteFile = async (publicId) => {
  try {
    await applyConfig();
    const result = await cloudinary.uploader.destroy(publicId);
    return { success: result.result === 'ok', result: result.result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  applyConfig,
  uploadFile,
  deleteFile,
  cloudinary
};
