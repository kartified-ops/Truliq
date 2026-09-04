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

    // 2. Access token expired, but refreshToken exists
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
 * Protected Route Component
 * Checks if user is authenticated before allowing access
 */
const ProtectedRoute = ({ children, userType = 'user', redirectTo = null }) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => checkIsAuthenticatedSync(userType));

  useEffect(() => {
    const isAuth = checkIsAuthenticatedSync(userType);
    setIsAuthenticated(isAuth);
  }, [userType, location.pathname]);

  if (isAuthenticated === false) {
    const defaultRedirects = {
      user: '/user/login',
      vendor: '/vendor/login',
      worker: '/worker/login',
      admin: '/admin/login'
    };

    const redirectPath = redirectTo || defaultRedirects[userType] || '/user/login';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
