const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isSuperAdmin } = require('../../middleware/roleMiddleware');
const {
  listIntegrations,
  getIntegration,
  updateIntegration,
  updateIntegrationStatus,
  testIntegration,
  getAuditLogs,
  getCatalog,
  switchActiveProvider,
  revealSecret
} = require('../../controllers/adminControllers/integrationController');

const integrationLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { success: false, message: 'Too many integration requests. Please try again later.' }
});

const testLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { success: false, message: 'Too many test requests. Please wait before trying again.' }
});

const revealLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { success: false, message: 'Too many reveal requests. Please wait a minute.' }
});

router.use(authenticate, isSuperAdmin, integrationLimiter);

router.get('/', listIntegrations);
router.get('/catalog', getCatalog);
router.get('/audit-logs', getAuditLogs);
router.get('/:serviceName', getIntegration);
router.put('/:serviceName', updateIntegration);
router.patch('/:serviceName/active-provider', switchActiveProvider);
router.patch('/:serviceName/status', updateIntegrationStatus);
router.post('/:serviceName/test', testLimiter, testIntegration);
router.post('/:serviceName/reveal', revealLimiter, revealSecret);

module.exports = router;
