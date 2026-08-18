const BANNER_AUDIENCES = {
  USER: 'user',
  WORKER: 'worker',
  ALL: 'all'
};

const normalizeBannerAudience = (audience) => {
  const value = String(audience || BANNER_AUDIENCES.ALL).toLowerCase().trim();
  return Object.values(BANNER_AUDIENCES).includes(value) ? value : BANNER_AUDIENCES.ALL;
};

const filterBannersByAudience = (banners = [], audience) => {
  const targetAudience = audience === BANNER_AUDIENCES.WORKER
    ? BANNER_AUDIENCES.WORKER
    : BANNER_AUDIENCES.USER;

  return (Array.isArray(banners) ? banners : []).filter((banner) => {
    const bannerAudience = normalizeBannerAudience(banner?.targetAudience);
    return bannerAudience === BANNER_AUDIENCES.ALL || bannerAudience === targetAudience;
  });
};

module.exports = {
  BANNER_AUDIENCES,
  normalizeBannerAudience,
  filterBannersByAudience
};
