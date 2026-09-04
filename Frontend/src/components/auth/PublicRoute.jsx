import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Storage keys by userType
 */
const getStorageKeys = (userType) => {
  switch (userType) {
    case 'vendor':
      return { tokenKey: 'vendorAccessToken', refreshTokenKey: 'vendorRefreshToken', dataKey: 'vendorData' };
    case 'worker':
      return { tokenKey: 'workerAccessToken', refreshTokenKey: 'workerRefreshToken', dataKey: 'workerData' };
    case 'admin':
      return { tokenKey: 'adminAccessToken', refreshTokenKey: 'adminRefreshToken', dataKey: 'adminData' };
    case 'user':
    default:
      return { tokenKey: 'accessToken', refreshTokenKey: 'refreshToken', dataKey: 'userData' };
  }
};

/**
 * Synchronous authentication check
 * Evaluates whether valid accessToken or valid refreshToken exists
 */
const checkIsAuthenticatedSync = (userType) => {
  try {
    const { tokenKey, refreshTokenKey, dataKey } = getStorageKeys(userType);
    const token = sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey);
    const refreshToken = sessionStorage.getItem(refreshTokenKey) || localStorage.getItem(refreshTokenKey);
    const userData = sessionStorage.getItem(dataKey) || localStorage.getItem(dataKey);

    if (!userData || (!token && !refreshToken)) {
      return false;
    }

    const currentTime = Date.now() / 1000;

    // 1. Check access token
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp > currentTime) {
          return true;
        }
      }
    }

    // 2. Access token expired or missing, but refreshToken exists.
    // The axios interceptor in api.js will seamlessly refresh on the first API call.
    if (refreshToken) {
      const refParts = refreshToken.split('.');
      if (refParts.length === 3) {
        const refPayload = JSON.parse(atob(refParts[1]));
        if (!refPayload.exp || refPayload.exp > currentTime) {
          return true;
        }
      } else {
        return true;
      }
    }

    return false;
  } catch (err) {
    return false;
  }
};

/**
 * Public Route Component
 * Redirects to dashboard if user is already authenticated without flashing login screen
 */
const PublicRoute = ({ children, userType = 'user', redirectTo = null }) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => checkIsAuthenticatedSync(userType));

  useEffect(() => {
    const isAuth = checkIsAuthenticatedSync(userType);
    setIsAuthenticated(isAuth);
  }, [userType, location.pathname]);

  if (isAuthenticated) {
    const defaultRedirects = {
      user: '/user',
      vendor: '/vendor/dashboard',
      worker: '/worker/dashboard',
      admin: '/admin/dashboard'
    };

    const redirectPath = redirectTo || defaultRedirects[userType] || '/user';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default PublicRoute;
