/**
 * Utility functions for smart location handling, permission checking,
 * and device GPS status detection across Truliq.
 */

/**
 * Safely check the browser's Geolocation permission state
 * @returns {Promise<'granted' | 'prompt' | 'denied' | 'unknown'>}
 */
export const getGeolocationPermissionState = async () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state; // 'granted' | 'prompt' | 'denied'
    }
  } catch (e) {
    // navigator.permissions query is not supported or failed
  }
  return 'unknown';
};

/**
 * Determines if a geolocation error indicates that device GPS/Location service is OFF.
 * @param {Error|object} error 
 * @returns {boolean}
 */
export const isGpsOffError = (error) => {
  if (!error) return false;

  // HTML5 Geolocation API error codes:
  // 1 = PERMISSION_DENIED
  // 2 = POSITION_UNAVAILABLE (device GPS is turned off or no signal)
  // 3 = TIMEOUT (request timed out, often due to GPS being off)
  if (error.code === 2 || error.code === 3) return true;

  const msg = (error.message || error.error || error.reason || '').toString().toLowerCase();
  return (
    msg.includes('position_unavailable') ||
    msg.includes('location disabled') ||
    msg.includes('gps') ||
    msg.includes('disabled') ||
    msg.includes('turned off') ||
    msg.includes('service disabled') ||
    msg.includes('unavailable')
  );
};

/**
 * Retrieves cached location/address from localStorage
 */
export const getCachedAddress = () => {
  try {
    const addr = localStorage.getItem('currentAddress');
    if (addr && addr !== 'Select Location' && addr.trim() !== '') {
      return addr;
    }
  } catch (e) {}
  return null;
};

/**
 * Saves address and city to localStorage
 */
export const setCachedAddress = (address, city = null) => {
  try {
    if (address) localStorage.setItem('currentAddress', address);
    if (city) localStorage.setItem('currentCity', city);
    localStorage.setItem('location_granted', 'true');
  } catch (e) {}
};
