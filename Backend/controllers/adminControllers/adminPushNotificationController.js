const {
  AUDIENCE_TYPES,
  NOTIFICATION_TYPES,
  CLICK_ACTIONS,
  getAllowedActionsForAudience,
  sendAdminPushNotification,
  listAdminPushHistory,
  getAdminPushHistoryById,
  searchRecipientsForAudience
} = require('../../services/adminPushNotificationService');

const getAudienceLabel = (audienceType) => {
  const labels = {
    [AUDIENCE_TYPES.ALL]: 'All',
    [AUDIENCE_TYPES.USERS]: 'Users',
    [AUDIENCE_TYPES.WORKERS]: 'Workers',
    [AUDIENCE_TYPES.VENDORS]: 'Vendors',
    [AUDIENCE_TYPES.SPECIFIC_USER]: 'Specific User',
    [AUDIENCE_TYPES.SPECIFIC_WORKER]: 'Specific Worker',
    [AUDIENCE_TYPES.SPECIFIC_VENDOR]: 'Specific Vendor'
  };
  return labels[audienceType] || audienceType;
};

exports.getPushNotificationOptions = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        audienceTypes: Object.values(AUDIENCE_TYPES).map((value) => ({
          value,
          label: getAudienceLabel(value)
        })),
        notificationTypes: NOTIFICATION_TYPES.map((value) => ({
          value,
          label: value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
        })),
        clickActions: Object.values(CLICK_ACTIONS).map((value) => ({
          value,
          label: value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
        }))
      }
    });
  } catch (error) {
    console.error('[Admin Push] Get options error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load push notification options.'
    });
  }
};

exports.getAllowedActions = async (req, res) => {
  try {
    const { audienceType } = req.query;
    if (!audienceType) {
      return res.status(400).json({
        success: false,
        message: 'Audience type is required.'
      });
    }

    const actions = getAllowedActionsForAudience(audienceType);
    res.status(200).json({
      success: true,
      data: actions.map((value) => ({
        value,
        label: value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
      }))
    });
  } catch (error) {
    console.error('[Admin Push] Get allowed actions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load allowed click actions.'
    });
  }
};

exports.searchRecipients = async (req, res) => {
  try {
    const { audienceType, search = '' } = req.query;
    if (!audienceType) {
      return res.status(400).json({
        success: false,
        message: 'Audience type is required.'
      });
    }

    const recipients = await searchRecipientsForAudience({ audienceType, search });
    res.status(200).json({
      success: true,
      data: recipients
    });
  } catch (error) {
    console.error('[Admin Push] Search recipients error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to search recipients.'
    });
  }
};

exports.sendPushNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      audienceType,
      notificationType = 'admin_notification',
      action = 'none',
      targetId = '',
      specificRecipientId = null
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Notification title is required.' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Notification message is required.' });
    }
    if (!audienceType) {
      return res.status(400).json({ success: false, message: 'Recipient type is required.' });
    }

    const result = await sendAdminPushNotification({
      adminId: req.user.id,
      title: String(title).trim(),
      message: String(message).trim(),
      audienceType,
      notificationType,
      action,
      targetId,
      specificRecipientId
    });

    if (!result.totalRecipients) {
      return res.status(400).json({
        success: false,
        message: 'No active FCM-enabled recipients found.'
      });
    }

    res.status(200).json({
      success: true,
      message: `Notification sent successfully to ${result.totalRecipients} recipient${result.totalRecipients === 1 ? '' : 's'}.`,
      data: {
        totalRecipients: result.totalRecipients,
        successfulCount: result.successfulCount,
        failedCount: result.failedCount,
        historyId: result.history?._id || null
      }
    });
  } catch (error) {
    console.error('[Admin Push] Send notification error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to send push notification.'
    });
  }
};

exports.getPushNotificationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await listAdminPushHistory({ page, limit });

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[Admin Push] Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch push notification history.'
    });
  }
};

exports.getPushNotificationHistoryById = async (req, res) => {
  try {
    const history = await getAdminPushHistoryById(req.params.id);
    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Push notification history not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('[Admin Push] Get history detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch push notification details.'
    });
  }
};
