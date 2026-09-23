/**
 * Admin City Scoping Helper
 * Enables role-based city scoping for non-super_admin admins
 */

const getAdminCityScope = (req) => {
  if (!req || !req.user) return null;
  // Super Admin has global access to all cities
  if (req.user.role === 'super_admin') return null;

  const cityName = req.user.cityName || req.user.cityId?.name || (typeof req.user.assignedCity === 'string' ? req.user.assignedCity : null);
  if (cityName && typeof cityName === 'string' && cityName.trim()) {
    return cityName.trim();
  }
  return null;
};

const getCityQueryFilter = (req, field = 'address.city') => {
  const city = getAdminCityScope(req);
  if (!city) return {};
  return { [field]: { $regex: new RegExp(`^${city}$`, 'i') } };
};

module.exports = {
  getAdminCityScope,
  getCityQueryFilter
};
