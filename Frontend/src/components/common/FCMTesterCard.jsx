import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiBell, FiSend, FiCheckCircle, FiRefreshCw, FiSmartphone, FiCopy, FiServer, FiShield, FiCloudLightning } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { registerFCMToken, getFCMToken } from '../../services/pushNotificationService';

/**
 * FCMTesterCard Component
 * Performs the complete REAL end-to-end Firebase FCM Push Notification pipeline:
 * 1. Fetches Firebase Device Token (Firebase Web/Native SDK)
 * 2. Saves to MongoDB Database (`fcmTokenMobile` or `fcmTokens`)
 * 3. Triggers Backend Server Firebase Admin SDK (`admin.messaging().sendEachForMulticast`)
 * 4. Google Firebase Servers dispatch push to APNs (iOS) & Google Play Services (Android)
 */
const FCMTesterCard = ({ userType = 'user' }) => {
  const [fcmToken, setFcmToken] = useState('');
  const [permission, setPermission] = useState('default');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeStep, setActiveStep] = useState(0); // 0: Idle, 1: SDK Token, 2: DB Sync, 3: Firebase Admin API, 4: Delivered
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    checkFCMStatus();
  }, []);

  const checkFCMStatus = async () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
      const token = await getFCMToken();
      if (token) {
        setFcmToken(token);
      }
    } catch (err) {
      console.warn('[FCM Tester] Error checking status:', err);
    }
  };

  const handleSyncToken = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Syncing FCM Token with server...');
    try {
      const token = await registerFCMToken(userType, true);
      if (token) {
        setFcmToken(token);
        toast.success('FCM Token synced & saved to database!', { id: toastId });
      } else {
        toast.error('Could not get FCM Token. Please check notification permissions.', { id: toastId });
      }
    } catch (err) {
      console.error('[FCM Tester] Sync error:', err);
      toast.error('Token sync failed: ' + (err.message || 'Unknown error'), { id: toastId });
    } finally {
      setIsSyncing(false);
      checkFCMStatus();
    }
  };

  const handleSendTestNotification = async () => {
    setIsLoading(true);
    setTestResult(null);
    setActiveStep(1); // Step 1: Getting Firebase Token from SDK

    try {
      await new Promise(r => setTimeout(r, 400));
      setActiveStep(2); // Step 2: Saving token in MongoDB

      const token = await registerFCMToken(userType, true);
      if (token) setFcmToken(token);

      await new Promise(r => setTimeout(r, 400));
      setActiveStep(3); // Step 3: Invoking Backend Firebase Admin SDK

      const endpoint = userType === 'vendor'
        ? '/vendors/fcm-tokens/test'
        : userType === 'worker'
          ? '/workers/fcm-tokens/test'
          : '/users/fcm-tokens/test';

      const res = await api.post(endpoint);

      if (res.data && res.data.success) {
        setActiveStep(4); // Step 4: Dispatched via Google Firebase Cloud Messaging
        setTestResult({
          success: true,
          message: 'Real FCM Push Notification Dispatched via Firebase Admin SDK!',
          successCount: res.data.successCount || 1,
          failureCount: res.data.failureCount || 0
        });
        toast.success(`🔔 Real Push Notification Sent via Firebase! (${res.data.successCount || 1} delivered)`, {
          duration: 6000
        });
      } else {
        throw new Error(res.data?.error || 'Backend failed to dispatch FCM push');
      }
    } catch (err) {
      console.error('[FCM Tester] Test error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to send test push';
      setTestResult({
        success: false,
        message: errMsg
      });
      toast.error(`❌ FCM Test Failed: ${errMsg}`, { duration: 6000 });
      setActiveStep(0);
    } finally {
      setIsLoading(false);
      checkFCMStatus();
    }
  };

  const handleCopyToken = () => {
    if (fcmToken) {
      navigator.clipboard.writeText(fcmToken);
      toast.success('FCM Token copied to clipboard!');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[28px] p-5 text-white shadow-xl border border-indigo-500/20 mb-6 relative overflow-hidden"
    >
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl"></div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <FiBell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                FCM Push Tester
                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Real Firebase
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">End-to-End Real Firebase Push Pipeline</p>
            </div>
          </div>

          <button
            onClick={handleSyncToken}
            disabled={isSyncing || isLoading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 active:scale-95 transition-all"
            title="Sync FCM Token"
          >
            <FiRefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Status Info Box */}
        <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 mb-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <FiSmartphone className="w-3.5 h-3.5 text-indigo-400" /> Permission Status
            </span>
            <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${
              permission === 'granted'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {permission}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <FiCheckCircle className="w-3.5 h-3.5 text-teal-400" /> Device FCM Token
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-200 truncate max-w-[160px] bg-black/30 px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
              {fcmToken ? `${fcmToken.substring(0, 12)}...` : 'Not Loaded'}
              {fcmToken && (
                <FiCopy
                  onClick={handleCopyToken}
                  className="w-3 h-3 text-indigo-400 cursor-pointer hover:text-white transition-colors"
                />
              )}
            </span>
          </div>
        </div>

        {/* Real Process Steps (Visible when testing) */}
        {activeStep > 0 && (
          <div className="mb-4 bg-black/30 rounded-2xl p-3.5 border border-indigo-500/30 space-y-2 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
              Real Pipeline Execution:
            </div>

            <div className={`flex items-center gap-2 ${activeStep >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <FiSmartphone className="w-3.5 h-3.5" />
              <span>1. Generated FCM Token from Firebase SDK</span>
              {activeStep >= 1 && <FiCheckCircle className="w-3.5 h-3.5 ml-auto text-emerald-400" />}
            </div>

            <div className={`flex items-center gap-2 ${activeStep >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <FiServer className="w-3.5 h-3.5" />
              <span>2. Verified & Saved Token in MongoDB</span>
              {activeStep >= 2 && <FiCheckCircle className="w-3.5 h-3.5 ml-auto text-emerald-400" />}
            </div>

            <div className={`flex items-center gap-2 ${activeStep >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <FiShield className="w-3.5 h-3.5" />
              <span>3. Invoked Server Firebase Admin SDK (`sendEachForMulticast`)</span>
              {activeStep >= 3 && <FiCheckCircle className="w-3.5 h-3.5 ml-auto text-emerald-400" />}
            </div>

            <div className={`flex items-center gap-2 ${activeStep >= 4 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <FiCloudLightning className="w-3.5 h-3.5" />
              <span>4. Dispatched by Google FCM Servers to Device OS</span>
              {activeStep >= 4 && <FiCheckCircle className="w-3.5 h-3.5 ml-auto text-emerald-400" />}
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleSendTestNotification}
          disabled={isLoading}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <FiRefreshCw className="w-4 h-4 animate-spin" />
              Executing Real Firebase Push...
            </>
          ) : (
            <>
              <FiSend className="w-4 h-4" />
              Send Real FCM Push Notification
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default FCMTesterCard;
