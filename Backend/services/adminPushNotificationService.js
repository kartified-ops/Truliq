const Notification = require('../models/Notification');
const User = require('../models/User');
const Worker = require('../models/Worker');
const Vendor = require('../models/Vendor');
const { sendPushNotification } = require('./firebaseAdmin');

const AUDIENCE_TYPES = {
  ALL: 'all',
  USERS: 'users',
  WORKERS: 'workers',
  VENDORS: 'vendors',
  SPECIFIC_USER: 'specific_user',
  SPECIFIC_WORKER: 'specific_worker',
  SPECIFIC_VENDOR: 'specific_vendor'
};

const NOTIFICATION_TYPES = [
  'admin_notification',
  'admin_promotion',
  'admin_reminder',
  'admin_system',
  'general'
];

const CLICK_ACTIONS = {
  NONE: 'none',
  OPEN_HOME: 'open_home',
  OPEN_JOBS: 'open_jobs',
  OPEN_JOB_DETAILS: 'open_job_details',
  OPEN_BOOKING: 'open_booking',
  OPEN_BOOKING_DETAILS: 'open_booking_details',
  OPEN_SUBSCRIPTION: 'open_subscription',
  OPEN_WALLET: 'open_wallet',
  OPEN_PROFILE: 'open_profile',
  OPEN_NOTIFICATIONS: 'open_notifications'
};

const MODEL_BY_AUDIENCE = {
  [AUDIENCE_TYPES.USERS]: { model: User, roleKey: 'user', idField: 'userId', nameField: 'name' },
  [AUDIENCE_TYPES.WORKERS]: { model: Worker, roleKey: 'worker', idField: 'workerId', nameField: 'name' },
  [AUDIENCE_TYPES.VENDORS]: { model: Vendor, roleKey: 'vendor', idField: 'vendorId', nameField: 'businessName' }
};

const SPECIFIC_AUDIENCE_MAP = {
  [AUDIENCE_TYPES.SPECIFIC_USER]: AUDIENCE_TYPES.USERS,
  [AUDIENCE_TYPES.SPECIFIC_WORKER]: AUDIENCE_TYPES.WORKERS,
  [AUDIENCE_TYPES.SPECIFIC_VENDOR]: AUDIENCE_TYPES.VENDORS
};

const SEARCH_LIMIT = 20;

const collectTokensFromRecipient = (recipient) => {
  const tokens = [
    ...(Array.isArray(recipient?.fcmTokens) ? recipient.fcmTokens : []),
    ...(Array.isArray(recipient?.fcmTokenMobile) ? recipient.fcmTokenMobile : [])
  ];

  return Array.from(new Set(
    tokens
      .filter((token) => typeof token === 'string')
      .map((token) => token.trim())
      .filter((token) => token && token !== 'null' && token !== 'undefined' && token !== 'verification-pending')
  ));
};

const getBasePathForRole = (roleKey) => {
  if (roleKey === 'user') return '/user';
  if (roleKey === 'worker') return '/worker';
  if (roleKey === 'vendor') return '/vendor';
  return '/';
};

const ACTION_REQUIREMENTS = {
  [CLICK_ACTIONS.NONE]: { targetRequired: false, roles: ['user', 'worker', 'vendor'] },
  [CLICK_ACTIONS.OPEN_HOME]: { targetRequired: false, roles: ['user', 'worker', 'vendor'] },
  [CLICK_ACTIONS.OPEN_WALLET]: { targetRequired: false, roles: ['user', 'worker', 'vendor'] },
  [CLICK_ACTIONS.OPEN_PROFILE]: { targetRequired: false, roles: ['user', 'worker', 'vendor'] },
  [CLICK_ACTIONS.OPEN_NOTIFICATIONS]: { targetRequired: false, roles: ['user', 'worker', 'vendor'] },
  [CLICK_ACTIONS.OPEN_JOBS]: { targetRequired: false, roles: ['worker', 'vendor'] },
  [CLICK_ACTIONS.OPEN_SUBSCRIPTION]: { targetRequired: false, roles: ['user', 'worker'] },
  [CLICK_ACTIONS.OPEN_BOOKING]: { targetRequired: false, roles: ['user', 'vendor'] },
  [CLICK_ACTIONS.OPEN_JOB_DETAILS]: { targetRequired: true, roles: ['worker'] },
  [CLICK_ACTIONS.OPEN_BOOKING_DETAILS]: { targetRequired: true, roles: ['user', 'vendor'] }
};

const buildLinkForRole = (roleKey, action, targetId) => {
  const base = getBasePathForRole(roleKey);

  switch (action) {
    case CLICK_ACTIONS.NONE:
      return '';
    case CLICK_ACTIONS.OPEN_HOME:
      return base;
    case CLICK_ACTIONS.OPEN_JOBS:
      return roleKey === 'worker' ? '/worker/jobs' : roleKey === 'vendor' ? '/vendor/jobs' : '';
    case CLICK_ACTIONS.OPEN_JOB_DETAILS:
      return roleKey === 'worker' && targetId ? `/worker/job/${targetId}` : '';
    case CLICK_ACTIONS.OPEN_BOOKING:
      return roleKey === 'user' ? '/user/my-bookings' : roleKey === 'vendor' ? '/vendor/jobs' : '';
    case CLICK_ACTIONS.OPEN_BOOKING_DETAILS:
      if (!targetId) return '';
      if (roleKey === 'user') return `/user/booking/${targetId}`;
      if (roleKey === 'vendor') return `/vendor/booking/${targetId}`;
      return '';
    case CLICK_ACTIONS.OPEN_SUBSCRIPTION:
      return roleKey === 'user' ? '/user/my-plan' : roleKey === 'worker' ? '/worker/subscription' : '';
    case CLICK_ACTIONS.OPEN_WALLET:
      return roleKey === 'user' ? '/user/wallet' : roleKey === 'worker' ? '/worker/wallet' : roleKey === 'vendor' ? '/vendor/wallet' : '';
    case CLICK_ACTIONS.OPEN_PROFILE:
      return roleKey === 'user' ? '/user/account' : roleKey === 'worker' ? '/worker/profile' : roleKey === 'vendor' ? '/vendor/profile' : '';
    case CLICK_ACTIONS.OPEN_NOTIFICATIONS:
      return `${base}/notifications`;
    default:
      return '';
  }
};

const getAllowedActionsForAudience = (audienceType) => {
  const resolvedAudience = SPECIFIC_AUDIENCE_MAP[audienceType] || audienceType;

  if (resolvedAudience === AUDIENCE_TYPES.ALL) {
    return Object.entries(ACTION_REQUIREMENTS)
      .filter(([, config]) => ['user', 'worker', 'vendor'].every((role) => config.roles.includes(role)))
      .map(([action]) => action);
  }

  const roleKey = MODEL_BY_AUDIENCE[resolvedAudience]?.roleKey;
  if (!roleKey) return [CLICK_ACTIONS.NONE];

  return Object.entries(ACTION_REQUIREMENTS)
    .filter(([, config]) => config.roles.includes(roleKey))
    .map(([action]) => action);
};

const validateActionForAudience = ({ audienceType, action, targetId }) => {
  const actionConfig = ACTION_REQUIREMENTS[action];
  if (!actionConfig) {
    return { valid: false, message: 'Invalid click action selected.' };
  }

  const allowedActions = getAllowedActionsForAudience(audienceType);
  if (!allowedActions.includes(action)) {
    return { valid: false, message: 'Selected click action is not supported for this audience.' };
  }

  if (actionConfig.targetRequired && !String(targetId || '').trim()) {
    return { valid: false, message: 'Target ID is required for the selected click action.' };
  }

  return { valid: true };
};

const normalizeAudienceType = (audienceType) => String(audienceType || '').trim().toLowerCase();
const normalizeNotificationType = (notificationType) => String(notificationType || '').trim().toLowerCase();
const normalizeAction = (action) => String(action || CLICK_ACTIONS.NONE).trim().toLowerCase();

const getRoleRecipients = async (audienceType, specificRecipientId = null) => {
  const config = MODEL_BY_AUDIENCE[audienceType];
  if (!config) return [];

  const query = specificRecipientId ? { _id: specificRecipientId } : {};
  if (config.roleKey === 'user') {
    query.role = 'user';
  }

  const recipients = await config.model.find(query)
    .select('_id name businessName email phone role fcmTokens fcmTokenMobile')
    .lean();

  return recipients
    .map((recipient) => {
      const tokens = collectTokensFromRecipient(recipient);
      return {
        id: String(recipient._id),
        roleKey: config.roleKey,
        idField: config.idField,
        name: recipient[config.nameField] || recipient.name || recipient.email || recipient.phone || String(recipient._id),
        tokens
      };
    })
    .filter((recipient) => recipient.tokens.length > 0);
};

const resolveRecipients = async ({ audienceType, specificRecipientId }) => {
  if (audienceType === AUDIENCE_TYPES.ALL) {
    const groups = await Promise.all([
      getRoleRecipients(AUDIENCE_TYPES.USERS),
      getRoleRecipients(AUDIENCE_TYPES.WORKERS),
      getRoleRecipients(AUDIENCE_TYPES.VENDORS)
    ]);
    return groups.flat();
  }

  if (SPECIFIC_AUDIENCE_MAP[audienceType]) {
    return getRoleRecipients(SPECIFIC_AUDIENCE_MAP[audienceType], specificRecipientId);
  }

  return getRoleRecipients(audienceType);
};

const buildRecipientNotificationDoc = ({
  recipient,
  title,
  message,
  notificationType,
  action,
  targetId,
  broadcastGroupId
}) => {
  const link = buildLinkForRole(recipient.roleKey, action, targetId);
  return {
    [recipient.idField]: recipient.id,
    type: notificationType,
    title,
    message,
    isBroadcast: false,
    broadcastGroupId,
    action,
    targetId: targetId || null,
    sentAt: new Date(),
    data: {
      category: 'admin_notification',
      type: notificationType,
      action,
      targetId: targetId || '',
      link,
      url: link,
      role: recipient.roleKey,
      broadcastGroupId
    }
  };
};

const buildHistoryNotificationDoc = ({
  adminId,
  title,
  message,
  audienceType,
  recipientIds,
  notificationType,
  action,
  targetId,
  totalRecipients,
  successfulCount,
  failedCount,
  broadcastGroupId
}) => ({
  adminId,
  type: notificationType,
  title,
  message,
  isBroadcast: true,
  broadcastGroupId,
  audienceType,
  recipientIds,
  action,
  targetId: targetId || null,
  totalRecipients,
  successfulCount,
  failedCount,
  sentAt: new Date(),
  data: {
    category: 'admin_notification',
    audienceType,
    action,
    targetId: targetId || '',
    totalRecipients,
    successfulCount,
    failedCount,
    broadcastGroupId
  }
});

const sendAdminPushNotification = async ({
  adminId,
  title,
  message,
  audienceType,
  notificationType,
  action = CLICK_ACTIONS.NONE,
  targetId = '',
  specificRecipientId = null
}) => {
  const resolvedAudience = normalizeAudienceType(audienceType);
  const resolvedNotificationType = normalizeNotificationType(notificationType);
  const resolvedAction = normalizeAction(action);
  const trimmedTargetId = String(targetId || '').trim();

  if (!title || !message) {
    throw new Error('Title and message are required.');
  }
  if (!Object.values(AUDIENCE_TYPES).includes(resolvedAudience)) {
    throw new Error('Invalid audience type.');
  }
  if (!NOTIFICATION_TYPES.includes(resolvedNotificationType)) {
    throw new Error('Invalid notification type.');
  }

  const actionValidation = validateActionForAudience({
    audienceType: resolvedAudience,
    action: resolvedAction,
    targetId: trimmedTargetId
  });
  if (!actionValidation.valid) {
    throw new Error(actionValidation.message);
  }

  if (SPECIFIC_AUDIENCE_MAP[resolvedAudience] && !specificRecipientId) {
    throw new Error('A specific recipient must be selected for this audience.');
  }

  const recipients = await resolveRecipients({
    audienceType: resolvedAudience,
    specificRecipientId
  });

  if (!recipients.length) {
    return {
      totalRecipients: 0,
      successfulCount: 0,
      failedCount: 0,
      recipientIds: [],
      history: null
    };
  }

  const broadcastGroupId = `admin_push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const recipientIds = recipients.map((recipient) => recipient.id);

  const recipientDocs = recipients.map((recipient) => buildRecipientNotificationDoc({
    recipient,
    title,
    message,
    notificationType: resolvedNotificationType,
    action: resolvedAction,
    targetId: trimmedTargetId,
    broadcastGroupId
  }));
  await Notification.insertMany(recipientDocs, { ordered: false });

  let successfulCount = 0;
  let failedCount = 0;

  const recipientsByRole = recipients.reduce((acc, recipient) => {
    if (!acc[recipient.roleKey]) acc[recipient.roleKey] = [];
    acc[recipient.roleKey].push(recipient);
    return acc;
  }, {});

  for (const [roleKey, roleRecipients] of Object.entries(recipientsByRole)) {
    const roleTokens = Array.from(new Set(roleRecipients.flatMap((recipient) => recipient.tokens)));
    const link = buildLinkForRole(roleKey, resolvedAction, trimmedTargetId);

    const response = await sendPushNotification(roleTokens, {
      title,
      body: message,
      dataOnly: false,
      notificationId: `${broadcastGroupId}_${roleKey}`,
      data: {
        category: 'admin_notification',
        type: resolvedNotificationType,
        action: resolvedAction,
        targetId: trimmedTargetId || '',
        link,
        url: link,
        role: roleKey,
        broadcastGroupId
      }
    });

    successfulCount += response.successCount || 0;
    failedCount += response.failureCount || 0;
  }

  const history = await Notification.create(buildHistoryNotificationDoc({
    adminId,
    title,
    message,
    audienceType: resolvedAudience,
    recipientIds,
    notificationType: resolvedNotificationType,
    action: resolvedAction,
    targetId: trimmedTargetId,
    totalRecipients: recipients.length,
    successfulCount,
    failedCount,
    broadcastGroupId
  }));

  return {
    totalRecipients: recipients.length,
    successfulCount,
    failedCount,
    recipientIds,
    history
  };
};

const listAdminPushHistory = async ({ page = 1, limit = 20 }) => {
  const skip = (Number(page) - 1) * Number(limit);
  const query = { isBroadcast: true, data: { $ne: null }, 'data.category': 'admin_notification' };

  const [items, total] = await Promise.all([
    Notification.find(query)
      .populate('adminId', 'name email role')
      .sort({ sentAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Notification.countDocuments(query)
  ]);

  return {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  };
};

const getAdminPushHistoryById = async (id) => {
  return Notification.findOne({
    _id: id,
    isBroadcast: true,
    'data.category': 'admin_notification'
  }).populate('adminId', 'name email role').lean();
};

const searchRecipientsForAudience = async ({ audienceType, search = '' }) => {
  const normalizedAudience = normalizeAudienceType(audienceType);
  const resolvedAudience = SPECIFIC_AUDIENCE_MAP[normalizedAudience] || normalizedAudience;
  const config = MODEL_BY_AUDIENCE[resolvedAudience];

  if (!config) {
    throw new Error('Invalid recipient role for search.');
  }

  const trimmedSearch = String(search || '').trim();
  const query = {};
  if (config.roleKey === 'user') {
    query.role = 'user';
  }
  if (trimmedSearch) {
    query.$or = [
      { name: { $regex: trimmedSearch, $options: 'i' } },
      { businessName: { $regex: trimmedSearch, $options: 'i' } },
      { email: { $regex: trimmedSearch, $options: 'i' } },
      { phone: { $regex: trimmedSearch, $options: 'i' } }
    ];
  }

  const recipients = await config.model.find(query)
    .select('_id name businessName email phone fcmTokens fcmTokenMobile')
    .sort({ createdAt: -1 })
    .limit(SEARCH_LIMIT)
    .lean();

  return recipients
    .map((recipient) => {
      const tokens = collectTokensFromRecipient(recipient);
      return {
        id: String(recipient._id),
        name: recipient.businessName || recipient.name || recipient.email || recipient.phone || String(recipient._id),
        email: recipient.email || '',
        phone: recipient.phone || '',
        role: config.roleKey,
        tokenCount: tokens.length
      };
    })
    .filter((recipient) => recipient.tokenCount > 0);
};

module.exports = {
  AUDIENCE_TYPES,
  NOTIFICATION_TYPES,
  CLICK_ACTIONS,
  getAllowedActionsForAudience,
  sendAdminPushNotification,
  listAdminPushHistory,
  getAdminPushHistoryById,
  searchRecipientsForAudience,
  buildLinkForRole,
  validateActionForAudience
};
