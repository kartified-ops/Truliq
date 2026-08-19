const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isSuperAdmin } = require('../../middleware/roleMiddleware');
const ctrl = require('../../controllers/adminControllers/dynamicProviderController');

const limiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { success: false, message: 'Too many requests. Please wait.' }
});

const testLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { success: false, message: 'Too many test requests. Please wait.' }
});

router.use(authenticate, isSuperAdmin, limiter);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/test-unsaved', testLimiter, ctrl.testUnsaved);
router.get('/:id', ctrl.get);
router.put('/:id', ctrl.update);
router.patch('/:id/activate', ctrl.activate);
router.patch('/:id/deactivate', ctrl.deactivate);
router.delete('/:id', ctrl.remove);
router.post('/:id/test', testLimiter, ctrl.test);

module.exports = router;
