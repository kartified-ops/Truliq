const PromotionalOffer = require('../../models/PromotionalOffer');
const Worker = require('../../models/Worker');
const {
  computeOfferStatus,
  buildOfferPayload,
  applyOfferToEligibleWorkers,
  cancelOffer,
  getOfferStats
} = require('../../services/promotionalOfferService');
const { createNotification } = require('../notificationControllers/notificationController');

const serializeOffer = async (offer) => {
  const plain = offer.toObject ? offer.toObject() : offer;
  const stats = await getOfferStats(plain);
  return {
    ...plain,
    status: computeOfferStatus(plain),
    stats
  };
};

const notifyEligibleWorkers = async (offer) => {
  try {
    const query = { 'subscription.expiryDate': { $gt: offer.startDate } };
    if (offer.targetType === 'SELECTED_WORKERS') {
      query._id = { $in: offer.selectedWorkers || [] };
    }
    const workers = await Worker.find(query).select('_id').lean();
    const durationLabel = offer.durationDays === 1 ? '1 day' : `${offer.durationDays} days`;

    await Promise.all(workers.map((worker) => createNotification({
      workerId: worker._id,
      type: 'promotional_offer',
      title: `🎉 ${offer.name}`,
      message: offer.description || `Enjoy ${durationLabel} of FREE platform fee. Your subscription will not be consumed during the offer period.`,
      relatedId: offer._id,
      relatedType: 'promotional_offer',
      data: {
        offerId: String(offer._id),
        offerType: offer.offerType,
        startDate: offer.startDate,
        endDate: offer.endDate
      },
      pushData: {
        type: 'promotional_offer',
        link: '/worker/subscription'
      }
    })));
  } catch (error) {
    console.error('[PromotionalOffer] Notify workers failed:', error);
  }
};

exports.listOffers = async (req, res) => {
  try {
    const offers = await PromotionalOffer.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const data = [];
    for (const offer of offers) {
      data.push(await serializeOffer(offer));
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[PromotionalOffer] List error:', error);
    res.status(500).json({ success: false, message: 'Failed to load promotional offers.' });
  }
};

exports.getOffer = async (req, res) => {
  try {
    const offer = await PromotionalOffer.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('selectedWorkers', 'name phone email');
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Promotional offer not found.' });
    }
    res.status(200).json({ success: true, data: await serializeOffer(offer) });
  } catch (error) {
    console.error('[PromotionalOffer] Get error:', error);
    res.status(500).json({ success: false, message: 'Failed to load promotional offer.' });
  }
};

exports.createOffer = async (req, res) => {
  try {
    const payload = buildOfferPayload(req.body);
    payload.createdBy = req.user.id;
    const offer = await PromotionalOffer.create(payload);
    await applyOfferToEligibleWorkers(offer);
    notifyEligibleWorkers(offer);
    res.status(201).json({
      success: true,
      message: 'Promotional offer created successfully.',
      data: await serializeOffer(offer)
    });
  } catch (error) {
    console.error('[PromotionalOffer] Create error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create promotional offer.' });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const offer = await PromotionalOffer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Promotional offer not found.' });
    }

    const payload = buildOfferPayload(req.body, { existing: offer });
    Object.assign(offer, payload);
    await offer.save();
    await applyOfferToEligibleWorkers(offer);

    res.status(200).json({
      success: true,
      message: 'Promotional offer updated successfully.',
      data: await serializeOffer(offer)
    });
  } catch (error) {
    console.error('[PromotionalOffer] Update error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update promotional offer.' });
  }
};

exports.updateOfferStatus = async (req, res) => {
  try {
    const offer = await PromotionalOffer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Promotional offer not found.' });
    }

    const nextActive = req.body.isActive !== false && req.body.status !== 'INACTIVE';
    if (!nextActive) {
      await cancelOffer(offer);
    } else {
      offer.isActive = true;
      await offer.save();
      await applyOfferToEligibleWorkers(offer);
    }

    res.status(200).json({
      success: true,
      message: nextActive ? 'Promotional offer activated.' : 'Promotional offer deactivated.',
      data: await serializeOffer(offer)
    });
  } catch (error) {
    console.error('[PromotionalOffer] Status error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update offer status.' });
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    const offer = await PromotionalOffer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Promotional offer not found.' });
    }
    await cancelOffer(offer);
    await offer.deleteOne();
    res.status(200).json({ success: true, message: 'Promotional offer cancelled successfully.' });
  } catch (error) {
    console.error('[PromotionalOffer] Delete error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to delete promotional offer.' });
  }
};

exports.searchWorkers = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const workers = await Worker.find(query)
      .select('name phone email subscription')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      data: workers.map((worker) => ({
        id: String(worker._id),
        name: worker.name,
        phone: worker.phone,
        email: worker.email || '',
        hasActiveSubscription: !!(worker.subscription?.expiryDate && new Date(worker.subscription.expiryDate) > new Date() && (worker.subscription.isActive === true || worker.subscription.status === 'ACTIVE'))
      }))
    });
  } catch (error) {
    console.error('[PromotionalOffer] Search workers error:', error);
    res.status(500).json({ success: false, message: 'Failed to search workers.' });
  }
};
