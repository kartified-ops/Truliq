/**
 * Firebase Admin Service — dynamic credentials via IntegrationConfigService
 */
const admin = require('firebase-admin');
const {
  getFirebaseCredentials,
  registerRefreshHook
} = require('./integrationConfigService');

const NotificationLog = require('../models/NotificationLog');

let initialized = false;
let initFingerprint = '';

const ensureFirebaseApp = async () => {
  const creds = await getFirebaseCredentials();
  const fingerprint = creds.projectId || '';
  if (!creds.enabled || !creds.serviceAccount) {
    initialized = false;
    return false;
  }

  if (initialized && initFingerprint === fingerprint && admin.apps.length) {
    return true;
  }

  if (admin.apps.length) {
    try {
      await Promise.all(admin.apps.map((app) => app.delete()));
    } catch (err) {
      console.warn('[Firebase] Failed to delete existing app:', err.message);
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(creds.serviceAccount),
    databaseURL: creds.databaseUrl || 'https://truliq-default-rtdb.asia-southeast1.firebasedatabase.app/'
  });

  initialized = true;
  initFingerprint = fingerprint;
  return true;
};

registerRefreshHook(() => {
  initialized = false;
  initFingerprint = '';
});

async function sendPushNotification(recipientOrTokens, payload) {
  try {
    const ready = await ensureFirebaseApp();
    if (!ready) {
      console.log('[FCM] Firebase not configured');
      return { successCount: 0, failureCount: 0 };
    }

    const userId = (recipientOrTokens && recipientOrTokens._id) ? String(recipientOrTokens._id) : 'anonymous';
    const type = payload.data?.type || 'generic';
    const relatedId = payload.data?.bookingId || payload.data?.id || Date.now();
    const notificationId = payload.notificationId || `${userId}_${type}_${relatedId}`;

    if (notificationId !== 'test-notification') {
      const alreadySent = await NotificationLog.findOne({ notificationId });
      if (alreadySent) {
        return { successCount: 0, failureCount: 0, duplicate: true };
      }
    }

    let tokens = [];
    let recipient = recipientOrTokens;

    if (typeof recipientOrTokens === 'string') {
      const Worker = require('../models/Worker');
      const User = require('../models/User');
      const Vendor = require('../models/Vendor');
      const [worker, user, vendor] = await Promise.all([
        Worker.findById(recipientOrTokens),
        User.findById(recipientOrTokens),
        Vendor.findById(recipientOrTokens)
      ]);
      recipient = worker || user || vendor;
    }

    if (Array.isArray(recipient)) {
      tokens = recipient;
    } else if (recipient && typeof recipient === 'object') {
      tokens = [...(recipient.fcmTokens || []), ...(recipient.fcmTokenMobile || [])];
      if (recipient.fcmToken) tokens.push(recipient.fcmToken);
    }

    if (!tokens.length) return { successCount: 0, failureCount: 0 };

    const uniqueTokens = Array.from(new Set(tokens.filter((t) => t && typeof t === 'string' && t.trim())));
    if (!uniqueTokens.length) return { successCount: 0, failureCount: 0 };

    const stringData = {
      title: payload.title || 'App Notification',
      body: payload.body || 'New Update',
      notificationId: String(notificationId)
    };
    if (payload.data) {
      Object.keys(payload.data).forEach((key) => {
        stringData[key] = String(payload.data[key]);
      });
    }

    const message = {
      data: stringData,
      tokens: uniqueTokens,
      android: { priority: 'high' },
      webpush: {
        headers: { Urgency: 'high', TTL: '86400' },
        fcmOptions: { link: payload.data?.link || '/' }
      }
    };

    if (!payload.dataOnly) {
      message.notification = {
        title: payload.title || 'App Notification',
        body: payload.body || 'New Update'
      };
      message.android.notification = {
        title: payload.title || 'App Notification',
        body: payload.body || 'New Update',
        icon: 'ic_notification',
        color: '#FF6B00',
        sound: 'default',
        channelId: payload.channelId || 'high_importance_channel',
        priority: 'high',
        visibility: 'public',
        defaultSound: true,
        defaultVibrateTimings: true
      };
      message.apns = {
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
        payload: {
          aps: {
            alert: { title: payload.title || 'App Notification', body: payload.body || 'New Update' },
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
            'content-available': 1
          }
        }
      };
    }

    const response = await admin.messaging().sendEachForMulticast(message);

    if (response.successCount > 0) {
      try {
        await NotificationLog.create({ notificationId, userId, tokens: uniqueTokens });
      } catch (logErr) {
        if (logErr.code !== 11000) console.error('[FCM Log Error]:', logErr.message);
      }
    }

    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (errorCode === 'messaging/registration-token-not-registered'
            || errorCode === 'messaging/invalid-registration-token') {
            invalidTokens.push(uniqueTokens[idx]);
          }
        }
      });
      if (invalidTokens.length) removeInvalidTokens(invalidTokens);
    }

    return response;
  } catch (error) {
    console.error('❌ Error sending push notification:', error.message);
    throw error;
  }
}

async function removeInvalidTokens(tokens) {
  try {
    const User = require('../models/User');
    const Vendor = require('../models/Vendor');
    const Worker = require('../models/Worker');
    const updateQuery = {
      $pull: { fcmTokens: { $in: tokens }, fcmTokenMobile: { $in: tokens } }
    };
    await Promise.all([
      User.updateMany({ $or: [{ fcmTokens: { $in: tokens } }, { fcmTokenMobile: { $in: tokens } }] }, updateQuery),
      Vendor.updateMany({ $or: [{ fcmTokens: { $in: tokens } }, { fcmTokenMobile: { $in: tokens } }] }, updateQuery),
      Worker.updateMany({ $or: [{ fcmTokens: { $in: tokens } }, { fcmTokenMobile: { $in: tokens } }] }, updateQuery)
    ]);
  } catch (err) {
    console.error('[FCM Cleanup] Error:', err.message);
  }
}

async function sendNotificationToUser(userId, payload, includeMobile = true) {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return;

    let tokens = [...(user.fcmTokens || [])];
    if (includeMobile && user.fcmTokenMobile?.length) tokens.push(...user.fcmTokenMobile);

    if (!tokens.length) return;

    await sendPushNotification(tokens, {
      ...payload,
      highPriority: payload.priority === 'high',
      dataOnly: false
    });
  } catch (error) {
    console.error(`[FCM] Error sending notification to user ${userId}:`, error.message);
  }
}

async function sendNotificationToVendor(vendorId, payload, includeMobile = true) {
  try {
    const Vendor = require('../models/Vendor');
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return;

    let tokens = [...(vendor.fcmTokens || [])];
    if (includeMobile && vendor.fcmTokenMobile?.length) tokens.push(...vendor.fcmTokenMobile);
    if (!tokens.length) return;

    await sendPushNotification(tokens, {
      ...payload,
      title: `🏢 [Partner] ${payload.title}`,
      dataOnly: false
    });
  } catch (error) {
    console.error(`[FCM] Error sending notification to vendor ${vendorId}:`, error.message);
  }
}

async function sendNotificationToWorker(workerId, payload, includeMobile = true) {
  try {
    const Worker = require('../models/Worker');
    const worker = await Worker.findById(workerId);
    if (!worker) return;

    let tokens = [...(worker.fcmTokens || [])];
    if (includeMobile && worker.fcmTokenMobile?.length) tokens.push(...worker.fcmTokenMobile);
    if (!tokens.length) return;

    await sendPushNotification(tokens, {
      ...payload,
      title: `👷 [Pro] ${payload.title}`,
      dataOnly: false
    });
  } catch (error) {
    console.error(`[FCM] Error sending notification to worker ${workerId}:`, error.message);
  }
}

async function sendNotificationToAdmin(adminId, payload, includeMobile = true) {
  try {
    const Admin = require('../models/Admin');
    const adminUser = await Admin.findById(adminId);
    if (!adminUser) return;

    let tokens = [...(adminUser.fcmTokens || [])];
    if (includeMobile && adminUser.fcmTokenMobile?.length) tokens.push(...adminUser.fcmTokenMobile);
    if (!tokens.length) return;

    await sendPushNotification(tokens, {
      ...payload,
      title: `🛡️ [Admin] ${payload.title}`
    });
  } catch (error) {
    console.error(`[FCM] Error sending notification to admin ${adminId}:`, error.message);
  }
}

module.exports = {
  ensureFirebaseApp,
  sendPushNotification,
  sendNotificationToUser,
  sendNotificationToVendor,
  sendNotificationToWorker,
  sendNotificationToAdmin
};
