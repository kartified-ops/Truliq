const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const {
  getPushNotificationOptions,
  getAllowedActions,
  searchRecipients,
  sendPushNotification,
  getPushNotificationHistory,
  getPushNotificationHistoryById
} = require('../../controllers/adminControllers/adminPushNotificationController');

router.use(authenticate, isAdmin);

router.get('/options', getPushNotificationOptions);
router.get('/actions', getAllowedActions);
router.get('/recipients', searchRecipients);
router.post('/send', sendPushNotification);
router.get('/history', getPushNotificationHistory);
router.get('/history/:id', getPushNotificationHistoryById);

module.exports = router;
