const Settings = require('../models/Settings');
const HomeContent = require('../models/HomeContent');

const formatBanners = (banners = []) => banners
  .filter((banner) => banner && banner.isActive !== false && banner.imageUrl)
  .sort((a, b) => (a.order || 0) - (b.order || 0))
  .map((banner, index) => ({
    id: banner._id?.toString?.() || `banner-${index}`,
    imageUrl: banner.imageUrl,
    text: banner.text || '',
    order: banner.order ?? index
  }));

const getWorkerDashboardBannerSettings = async () => {
  const settings = await Settings.findOne({ type: 'global' }).lean();
  const workerDashboard = settings?.workerDashboard || {};

  return {
    isBannersVisible: workerDashboard.isBannersVisible !== false,
    banners: formatBanners(workerDashboard.banners || []),
    updatedBy: workerDashboard.updatedBy || null,
    updatedAt: workerDashboard.updatedAt || null
  };
};

const saveWorkerDashboardBannerSettings = async ({ isBannersVisible, banners, adminId }) => {
  const parsedBanners = Array.isArray(banners)
    ? banners
      .filter((banner) => banner?.imageUrl)
      .map((banner, index) => ({
        imageUrl: String(banner.imageUrl).trim(),
        text: banner.text ? String(banner.text).trim() : '',
        isActive: banner.isActive !== false,
        order: Number.isInteger(Number(banner.order)) ? Number(banner.order) : index
      }))
    : [];

  const now = new Date();
  const update = {
    'workerDashboard.isBannersVisible': isBannersVisible !== false,
    'workerDashboard.banners': parsedBanners,
    'workerDashboard.updatedAt': now
  };
  if (adminId) update['workerDashboard.updatedBy'] = adminId;

  const settings = await Settings.findOneAndUpdate(
    { type: 'global' },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return getWorkerDashboardBannerSettingsFromDoc(settings);
};

const getWorkerDashboardBannerSettingsFromDoc = (settings) => {
  const workerDashboard = settings?.workerDashboard || {};
  return {
    isBannersVisible: workerDashboard.isBannersVisible !== false,
    banners: formatBanners(workerDashboard.banners || []),
    updatedBy: workerDashboard.updatedBy || null,
    updatedAt: workerDashboard.updatedAt || null
  };
};

/**
 * Banners shown on worker dashboard.
 * Priority:
 * 1. Dedicated worker dashboard banners (Settings.workerDashboard)
 * 2. Fallback to latest user Home Content banners (for backwards compatibility)
 */
const getWorkerDashboardBannersForWorker = async () => {
  const settings = await Settings.findOne({ type: 'global' }).lean();
  const workerDashboard = settings?.workerDashboard;

  if (workerDashboard?.banners?.length) {
    return {
      isVisible: workerDashboard.isBannersVisible !== false,
      banners: formatBanners(workerDashboard.banners),
      source: 'worker_dashboard'
    };
  }

  let homeContent = await HomeContent.findOne({
    cityId: null,
    isBannersVisible: { $ne: false }
  }).lean();

  if (!homeContent?.banners?.length) {
    homeContent = await HomeContent.findOne({
      'banners.0': { $exists: true },
      isBannersVisible: { $ne: false }
    }).sort({ updatedAt: -1 }).lean();
  }

  return {
    isVisible: homeContent?.isBannersVisible !== false,
    banners: formatBanners((homeContent?.banners || []).map((banner) => ({
      ...banner,
      isActive: true
    }))),
    source: 'home_content_fallback'
  };
};

module.exports = {
  formatBanners,
  getWorkerDashboardBannerSettings,
  saveWorkerDashboardBannerSettings,
  getWorkerDashboardBannersForWorker
};
