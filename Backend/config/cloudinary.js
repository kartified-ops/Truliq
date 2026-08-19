const cloudinary = require('cloudinary').v2;
const { applyConfig } = require('../services/cloudinaryService');

applyConfig().catch((err) => {
  console.warn('[Cloudinary config] Initial load failed:', err.message);
});

module.exports = cloudinary;
