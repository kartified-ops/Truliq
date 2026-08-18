const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isWorker } = require('../../middleware/roleMiddleware');
const {
  getDashboardStats,
  getDashboardBanners
} = require('../../controllers/workerControllers/workerDashboardController');

// Routes
router.get('/stats', authenticate, isWorker, getDashboardStats);
router.get('/banners', authenticate, isWorker, getDashboardBanners);

module.exports = router;
