const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/roleMiddleware');
const {
  listOffers,
  getOffer,
  createOffer,
  updateOffer,
  updateOfferStatus,
  deleteOffer,
  searchWorkers
} = require('../../controllers/adminControllers/promotionalOfferController');

router.use(authenticate, isAdmin);

router.get('/workers', searchWorkers);
router.get('/', listOffers);
router.post('/', createOffer);
router.get('/:id', getOffer);
router.put('/:id', updateOffer);
router.patch('/:id/status', updateOfferStatus);
router.delete('/:id', deleteOffer);

module.exports = router;
