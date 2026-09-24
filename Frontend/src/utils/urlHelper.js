/**
 * Smart URL Helper — Single source of truth for all URL resolution.
 * All components MUST use these helpers instead of hardcoding URLs.
 *
 * Priority:
 *   1. VITE_API_BASE_URL from .env (baked at build time)
 *   2. window.location.origin (auto-detect in production)
 *   3. http://localhost:6000/api  (local dev fallback)
 */

const DEV_FALLBACK = 'http://localhost:6000/api';

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  // If env var is set and NOT a localhost value → use it directly
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // Running in browser on a live domain (VPS / production)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.origin}/api`;
  }

  // Local development
  return envUrl || DEV_FALLBACK;
};

export const getSocketUrl = () => {
  return getApiBaseUrl().replace(/\/api$/, '');
};

/**
 * Convert a relative or partial asset path to a full URL.
 * e.g. "/upload/img.png" → "https://truliq.com/upload/img.png"
 */
export const toAssetUrl = (url) => {
  if (!url) return '';
  const clean = url.replace('/api/upload', '/upload');
  if (clean.startsWith('http')) return clean;
  const base = getSocketUrl();
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
};
