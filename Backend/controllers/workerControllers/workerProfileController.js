const Worker = require('../../models/Worker');
const { validationResult } = require('express-validator');
const cloudinaryService = require('../../services/cloudinaryService');
const { expireSubscriptionIfNeeded, isSubscriptionCurrentlyActive } = require('../../utils/workerSubscriptionUtil');

/**
 * Get worker profile
 */
const getProfile = async (req, res) => {
  try {
    const workerId = req.user.id;

    const worker = await Worker.findById(workerId).select('-password -__v').lean();

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    res.status(200).json({
      success: true,
      worker: {
        id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        serviceCategories: worker.serviceCategories || [],
        serviceCategory: worker.serviceCategories?.[0] || '', // Legacy support
        skills: worker.skills || [],
        address: worker.address || null,
        rating: worker.rating || 0,
        totalJobs: worker.totalJobs || 0,
        completedJobs: worker.completedJobs || 0,
        status: worker.status,
        approvalStatus: worker.approvalStatus || 'pending',
        approvalDate: worker.approvalDate || null,
        rejectedReason: worker.rejectedReason || null,
        profilePhoto: worker.profilePhoto || null,
        settings: worker.settings || { notifications: true, language: 'en' },
        isPhoneVerified: worker.isPhoneVerified || false,
        isEmailVerified: worker.isEmailVerified || false,
        isOnline: worker.isOnline || false,
        createdAt: worker.createdAt,
        updatedAt: worker.updatedAt
      }
    });
  } catch (error) {
    console.error('Get worker profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile. Please try again.'
    });
  }
};

/**
 * Update worker profile
 */
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const workerId = req.user.id;
    const { name, email, serviceCategories, serviceCategory, skills, address, status, profilePhoto } = req.body;

    const worker = await Worker.findById(workerId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Update fields
    if (name) worker.name = name.trim();

    // Handle email safely (convert empty strings to null for sparse index)
    if (email !== undefined) {
      const cleanEmail = email ? String(email).trim().toLowerCase() : null;
      if (cleanEmail && cleanEmail !== worker.email) {
        const existingWorker = await Worker.findOne({ email: cleanEmail, _id: { $ne: worker._id } });
        if (existingWorker) {
          return res.status(400).json({
            success: false,
            message: 'Email is already registered with another account'
          });
        }
      }
      worker.email = cleanEmail || null;
    }

    // Handle categories: prefer array, fallback to single legacy string
    if (serviceCategories && Array.isArray(serviceCategories)) {
      worker.serviceCategories = serviceCategories.filter(c => typeof c === 'string' && c.trim());
    } else if (serviceCategory && typeof serviceCategory === 'string') {
      worker.serviceCategories = [serviceCategory.trim()];
    }

    if (skills && Array.isArray(skills)) worker.skills = skills;
    if (address) {
      const fullAddr = address.fullAddress || [
        address.addressLine1 || worker.address?.addressLine1,
        address.addressLine2 || worker.address?.addressLine2,
        address.city || worker.address?.city,
        address.state || worker.address?.state,
        address.pincode || worker.address?.pincode
      ].filter(Boolean).join(', ') || worker.address?.fullAddress || '';

      const locObj = (address.location && typeof address.location === 'object') ? address.location : worker.address?.location;
      const hasLat = locObj && locObj.lat !== undefined && locObj.lat !== null && locObj.lat !== '' && !isNaN(Number(locObj.lat));
      const hasLng = locObj && locObj.lng !== undefined && locObj.lng !== null && locObj.lng !== '' && !isNaN(Number(locObj.lng));
      const hasValidCoords = hasLat && hasLng;

      worker.address = {
        addressLine1: address.addressLine1 !== undefined ? address.addressLine1 : (worker.address?.addressLine1 || ''),
        addressLine2: address.addressLine2 !== undefined ? address.addressLine2 : (worker.address?.addressLine2 || ''),
        city: address.city !== undefined ? address.city : (worker.address?.city || ''),
        state: address.state !== undefined ? address.state : (worker.address?.state || ''),
        country: address.country || worker.address?.country || 'India',
        pincode: address.pincode !== undefined ? address.pincode : (worker.address?.pincode || ''),
        landmark: address.landmark !== undefined ? address.landmark : (worker.address?.landmark || ''),
        fullAddress: fullAddr,
        location: hasValidCoords ? { lat: Number(locObj.lat), lng: Number(locObj.lng) } : (worker.address?.location || undefined)
      };

      if (hasValidCoords) {
        const latNum = Number(locObj.lat);
        const lngNum = Number(locObj.lng);
        worker.location = {
          lat: latNum,
          lng: lngNum,
          updatedAt: new Date()
        };
        worker.geoLocation = {
          type: 'Point',
          coordinates: [lngNum, latNum]
        };
      }
    }
    if (status) worker.status = status;
    // Update profile photo - upload to Cloudinary if it's a base64 string
    if (profilePhoto !== undefined) {
      if (profilePhoto && profilePhoto.startsWith('data:')) {
        const uploadRes = await cloudinaryService.uploadFile(profilePhoto, { folder: 'workers/profiles' });
        if (uploadRes.success) {
          worker.profilePhoto = uploadRes.url;
        }
      } else {
        worker.profilePhoto = profilePhoto;
      }
    }

    if (req.body.settings) {
      worker.settings = {
        notifications: req.body.settings.notifications !== undefined ? req.body.settings.notifications : (worker.settings?.notifications ?? true),
        soundAlerts: req.body.settings.soundAlerts !== undefined ? req.body.settings.soundAlerts : (worker.settings?.soundAlerts ?? true),
        language: req.body.settings.language || worker.settings?.language || 'en'
      };
    }

    await worker.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      worker: {
        id: worker._id,
        name: worker.name,
        email: worker.email,
        phone: worker.phone,
        serviceCategories: worker.serviceCategories,
        serviceCategory: worker.serviceCategories?.[0] || '',
        skills: worker.skills,
        address: worker.address,
        rating: worker.rating,
        totalJobs: worker.totalJobs,
        completedJobs: worker.completedJobs,
        status: worker.status,
        profilePhoto: worker.profilePhoto, // Include in response
        settings: worker.settings,
        isPhoneVerified: worker.isPhoneVerified,
        isEmailVerified: worker.isEmailVerified
      }
    });
  } catch (error) {
    console.error('Update worker profile error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'Field';
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} is already registered with another account.`
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile. Please try again.'
    });
  }
};

/**
 * Update worker real-time location (called periodically when online)
 */
const updateLocation = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
    }

    // Update both location formats:
    // - location: simple lat/lng for display
    // - geoLocation: GeoJSON Point for 2dsphere spatial queries (booking matching)
    await Worker.findByIdAndUpdate(workerId, {
      location: { lat, lng, updatedAt: new Date() },
      geoLocation: {
        type: 'Point',
        coordinates: [lng, lat] // GeoJSON format: [longitude, latitude]
      },
      lastSeenAt: new Date()
    });

    res.status(200).json({ success: true, message: 'Location updated' });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Toggle worker online/offline status
 * When going ONLINE: requires lat/lng to set current position
 * When going OFFLINE: clears online status
 */
const toggleOnline = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { isOnline, lat, lng } = req.body;

    if (isOnline) {
      const workerDoc = await Worker.findById(workerId).select('subscription');
      if (!workerDoc) {
        return res.status(404).json({ success: false, message: 'Worker not found' });
      }
      const now = new Date();
      if (expireSubscriptionIfNeeded(workerDoc, now)) {
        await workerDoc.save();
      }
      if (!isSubscriptionCurrentlyActive(workerDoc.subscription, now)) {
        const hadSubscription = !!workerDoc.subscription?.expiryDate;
        const isTrial = workerDoc.subscription?.planType === 'TRIAL';
        return res.status(403).json({
          success: false,
          code: hadSubscription ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_REQUIRED',
          message: isTrial
            ? 'Your free subscription has expired. Please upgrade to a paid plan to continue.'
            : (hadSubscription
              ? 'Your subscription has expired. Please upgrade your plan.'
              : 'You need an active subscription to go online. Please upgrade your plan.')
        });
      }
    }

    const updateData = {
      status: isOnline ? 'ONLINE' : 'OFFLINE', // Manual duty status
      isOnline: !!isOnline,
      lastSeenAt: new Date()
    };

    // When going online, also update live location
    if (isOnline && lat !== undefined && lng !== undefined) {
      updateData.location = { lat, lng, updatedAt: new Date() };
      updateData.geoLocation = {
        type: 'Point',
        coordinates: [lng, lat]
      };
    }

    const worker = await Worker.findByIdAndUpdate(workerId, updateData, { new: true })
      .select('isOnline geoLocation location');

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    console.log(`[Worker] ${workerId} is now ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}${isOnline ? ` at [${lat}, ${lng}]` : ''}`);

    res.status(200).json({
      success: true,
      message: isOnline ? 'You are now online! You will receive job alerts.' : 'You are now offline.',
      data: { isOnline: worker.isOnline }
    });
  } catch (error) {
    console.error('Toggle online error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Delete worker profile (Soft Delete - Preserves all history, completed jobs, and earnings for Admin)
 */
const deleteProfile = async (req, res) => {
  try {
    const workerId = req.user.id;
    
    // Check if worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Send push notification to worker before clearing tokens
    try {
      const { sendPushNotification } = require('../../services/firebaseAdmin');
      await sendPushNotification(worker, {
        title: 'Account Deleted 👋',
        body: 'Your worker account has been deleted.',
        priority: 'high',
        data: {
          type: 'worker_deleted',
          workerId: worker._id.toString()
        }
      });
    } catch (pushErr) {
      console.error('[WorkerDelete] Push notification failed:', pushErr);
    }

    const now = new Date();
    const originalPhone = worker.originalPhone || worker.phone;
    const originalEmail = worker.originalEmail || worker.email;

    // Soft delete worker and release unique phone/email constraint for fresh future signups
    worker.isDeleted = true;
    worker.deletedAt = now;
    worker.deleteReason = req.body?.reason || 'Worker self-deleted account';
    worker.isActive = false;
    worker.isOnline = false;
    worker.status = WORKER_STATUS.OFFLINE;
    worker.originalPhone = originalPhone;
    worker.originalEmail = originalEmail || null;
    worker.phone = `deleted_${now.getTime()}_${originalPhone}`;
    if (worker.email) {
      worker.email = `deleted_${now.getTime()}_${originalEmail}`;
    }
    worker.fcmTokens = [];
    worker.fcmTokenMobile = [];
    worker.loginSessionId = null;

    await worker.save();

    console.log(`[WorkerDelete] 🗑️ Soft-deleted worker ${workerId} (${originalPhone}). Historical records preserved for Admin.`);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account. Please try again.'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateLocation,
  toggleOnline,
  deleteProfile
};
