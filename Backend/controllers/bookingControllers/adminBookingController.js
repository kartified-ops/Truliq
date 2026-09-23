const Booking = require('../../models/Booking');
const User = require('../../models/User');
const { validationResult } = require('express-validator');
const { BOOKING_STATUS } = require('../../utils/constants');
const { getAdminCityScope, getCityQueryFilter } = require('../../utils/adminScope');

/**
 * Get all bookings with filters and search
 */
const getAllBookings = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      userId,
      vendorId,
      workerId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = {};

    // Role-based city filter for non-super_admin
    const cityFilter = getCityQueryFilter(req, 'address.city');
    Object.assign(query, cityFilter);

    if (status && status !== 'all' && status !== 'All Status' && status !== 'ALL_STATUS') {
      const s = String(status).trim().toLowerCase();
      if (s === 'pending' || s === 'awaiting') {
        query.status = {
          $in: [
            BOOKING_STATUS.PENDING,
            BOOKING_STATUS.SEARCHING,
            BOOKING_STATUS.REQUESTED,
            BOOKING_STATUS.AWAITING_PAYMENT,
            'pending',
            'searching',
            'requested',
            'awaiting_payment'
          ]
        };
      } else if (s === 'confirmed') {
        query.status = {
          $in: [
            BOOKING_STATUS.CONFIRMED,
            BOOKING_STATUS.ACCEPTED,
            BOOKING_STATUS.ASSIGNED,
            'confirmed',
            'accepted',
            'assigned'
          ]
        };
      } else if (s === 'in_progress' || s === 'inprogress' || s === 'ongoing') {
        query.status = {
          $in: [
            BOOKING_STATUS.IN_PROGRESS,
            BOOKING_STATUS.JOURNEY_STARTED,
            BOOKING_STATUS.VISITED,
            BOOKING_STATUS.WORK_DONE,
            'in_progress',
            'journey_started',
            'visited',
            'work_done'
          ]
        };
      } else if (s === 'completed' || s === 'delivered') {
        query.status = {
          $in: [
            BOOKING_STATUS.COMPLETED,
            'completed'
          ]
        };
      } else if (s === 'cancelled' || s === 'canceled') {
        query.status = {
          $in: [
            BOOKING_STATUS.CANCELLED,
            BOOKING_STATUS.REJECTED,
            BOOKING_STATUS.NO_VENDORS,
            'cancelled',
            'canceled',
            'rejected',
            'no_vendors'
          ]
        };
      } else {
        query.status = { $regex: new RegExp(`^${s}$`, 'i') };
      }
    }

    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (userId) query.userId = userId;
    if (vendorId) query.vendorId = vendorId;
    if (workerId) query.workerId = workerId;

    if (startDate || endDate) {
      const dateCondition = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateCondition.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateCondition.$lte = end;
      }
      query.createdAt = dateCondition;
    }

    // Search by booking number, service name, or customer name
    const trimmedSearch = typeof search === 'string' ? search.trim() : '';
    if (trimmedSearch) {
      const matchingUsers = await User.find({ name: { $regex: trimmedSearch, $options: 'i' } }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      query.$or = [
        { bookingNumber: { $regex: trimmedSearch, $options: 'i' } },
        { serviceName: { $regex: trimmedSearch, $options: 'i' } },
        { userId: { $in: userIds } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bookings
    const bookings = await Booking.find(query)
      .populate('userId', 'name phone email')
      .populate('vendorId', 'name businessName phone')
      .populate('serviceId', 'title iconUrl')
      .populate('categoryId', 'title slug')
      .populate('workerId', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings. Please try again.'
    });
  }
};

/**
 * Get booking details by ID
 */
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('userId', 'name phone email addresses')
      .populate('vendorId', 'name businessName phone email address')
      .populate('serviceId', 'title description iconUrl images')
      .populate('categoryId', 'title slug')
      .populate('workerId', 'name phone rating totalJobs completedJobs');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Role-based city check
    const city = getAdminCityScope(req);
    if (city && booking.address?.city && booking.address.city.toLowerCase() !== city.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You only have access to bookings in ${city}.`
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking. Please try again.'
    });
  }
};

/**
 * Cancel booking (admin)
 */
const cancelBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { cancellationReason } = req.body;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Role-based city check
    const city = getAdminCityScope(req);
    if (city && booking.address?.city && booking.address.city.toLowerCase() !== city.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You cannot cancel bookings outside ${city}.`
      });
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    if (booking.status === BOOKING_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed booking'
      });
    }

    // Update booking
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancelledAt = new Date();
    booking.cancelledBy = 'admin';
    booking.cancellationReason = cancellationReason || 'Cancelled by admin';

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking. Please try again.'
    });
  }
};

/**
 * Get booking analytics
 */
const getBookingAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    const cityFilter = getCityQueryFilter(req, 'address.city');
    Object.assign(dateFilter, cityFilter);

    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    // Total bookings
    const totalBookings = await Booking.countDocuments(dateFilter);

    // Bookings by status
    const bookingsByStatus = await Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Bookings by payment status
    const bookingsByPaymentStatus = await Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Revenue analytics
    const revenueStats = await Booking.aggregate([
      {
        $match: {
          ...dateFilter,
          paymentStatus: 'success'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalAmount' },
          totalBookings: { $sum: 1 },
          averageBookingValue: { $avg: '$finalAmount' }
        }
      }
    ]);

    // Daily bookings trend (last 30 days)
    const dailyTrend = await Booking.aggregate([
      {
        $match: {
          ...dateFilter,
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$finalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBookings,
        bookingsByStatus: bookingsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bookingsByPaymentStatus: bookingsByPaymentStatus.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount
          };
          return acc;
        }, {}),
        revenue: revenueStats[0] || {
          totalRevenue: 0,
          totalBookings: 0,
          averageBookingValue: 0
        },
        dailyTrend
      }
    });
  } catch (error) {
    console.error('Get booking analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics. Please try again.'
    });
  }
};

module.exports = {
  getAllBookings,
  getBookingById,
  cancelBooking,
  getBookingAnalytics
};

