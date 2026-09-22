const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Worker = require('../../models/Worker');
const Booking = require('../../models/Booking');
const Withdrawal = require('../../models/Withdrawal');
const Settlement = require('../../models/Settlement');
const Scrap = require('../../models/Scrap');
const Transaction = require('../../models/Transaction');
const UserService = require('../../models/UserService');
const { BOOKING_STATUS, PAYMENT_STATUS, VENDOR_STATUS } = require('../../utils/constants');
const { getCommissionRates } = require('../../utils/commission');

/**
 * Get overall dashboard stats
 */
const getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    // Revenue date filter (use completedAt for revenue consistency)
    const revenueDateFilter = {};
    if (startDate || endDate) {
      revenueDateFilter.completedAt = {};
      if (startDate) revenueDateFilter.completedAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        revenueDateFilter.completedAt.$lte = end;
      }
    }

    const [
      bookingStatsResult,
      totalUsers,
      totalVendors,
      totalWorkers,
      revenueResult,
      commissionData,
      pendingVendors,
      approvedVendors,
      pendingWithdrawals,
      pendingSettlementsCount,
      pendingScraps,
      recentActivityDocs,
      subscriptionRevenueResult
    ] = await Promise.all([
      // 1. Total & Status Counts in 1 Aggregate
      Booking.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            pendingBookings: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$status',
                      [
                        BOOKING_STATUS.COMPLETED,
                        BOOKING_STATUS.CANCELLED,
                        'completed',
                        'cancelled',
                        'canceled'
                      ]
                    ]
                  },
                  0,
                  1
                ]
              }
            },
            completedBookings: {
              $sum: {
                $cond: [
                  { $in: ['$status', [BOOKING_STATUS.COMPLETED, 'completed']] },
                  1,
                  0
                ]
              }
            },
            cancelledBookings: {
              $sum: {
                $cond: [
                  { $in: ['$status', [BOOKING_STATUS.CANCELLED, 'cancelled', 'canceled']] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      // 2. Total Users
      User.countDocuments({ role: 'user', isActive: true, ...dateFilter }),
      // 3. Total Vendors
      Vendor.countDocuments({ isActive: true, ...dateFilter }),
      // 4. Total Workers
      Worker.countDocuments({ isActive: true, ...dateFilter }),
      // 5. Booking Revenue
      Booking.aggregate([
        {
          $match: {
            status: { $in: [BOOKING_STATUS.COMPLETED, 'completed'] },
            paymentStatus: {
              $in: [
                PAYMENT_STATUS.SUCCESS,
                PAYMENT_STATUS.COLLECTED_BY_VENDOR,
                'success',
                'collected_by_vendor',
                'collected_by_worker',
                'paid'
              ]
            },
            ...revenueDateFilter
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$finalAmount', { $ifNull: ['$basePrice', 0] }] } },
            totalBookings: { $sum: 1 }
          }
        }
      ]),
      // 6. Commission rates
      getCommissionRates(),
      // 7. Pending Vendors
      Vendor.countDocuments({ approvalStatus: VENDOR_STATUS.PENDING, ...dateFilter }),
      // 8. Approved Vendors
      Vendor.countDocuments({ approvalStatus: VENDOR_STATUS.APPROVED, ...dateFilter }),
      // 9. Pending Withdrawals
      Withdrawal.countDocuments({ status: 'pending', ...dateFilter }),
      // 10. Pending Settlements
      Settlement.countDocuments({ status: 'pending', ...dateFilter }),
      // 11. Pending Scraps
      Scrap.countDocuments({ status: 'pending', ...dateFilter }),
      // 12. Recent Activities
      Booking.find(dateFilter)
        .populate('userId', 'name phone')
        .populate('vendorId', 'name businessName')
        .populate('serviceId', 'title')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      // 13. Subscription Revenue
      Transaction.aggregate([
        {
          $match: {
            type: 'worker_subscription',
            status: 'completed',
            ...dateFilter
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const bookingStats = bookingStatsResult[0] || {
      totalBookings: 0,
      pendingBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0
    };

    const revenue = revenueResult[0] || { totalRevenue: 0, totalBookings: 0 };
    const { platformShare } = commissionData || { platformShare: 0.1 };
    const platformCommission = revenue.totalRevenue * platformShare;
    const workerSubscriptionRevenue = subscriptionRevenueResult[0]?.total || 0;

    const recentBookings = (recentActivityDocs || []).map(b => ({
      id: b.bookingNumber || b._id,
      _id: b._id,
      status: b.status,
      user: { name: b.userId?.name || 'Customer' },
      serviceType: b.serviceId?.title || b.serviceName,
      price: b.finalAmount || b.basePrice || 0,
      createdAt: b.createdAt,
      acceptedAt: b.acceptedAt,
      assignedAt: b.assignedAt,
      visitedAt: b.visitedAt,
      completedAt: b.completedAt,
      workerPaymentStatus: b.workerPaymentStatus
    }));

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalVendors,
          totalWorkers,
          totalBookings: bookingStats.totalBookings,
          pendingBookings: bookingStats.pendingBookings,
          completedBookings: bookingStats.completedBookings,
          cancelledBookings: bookingStats.cancelledBookings,
          totalRevenue: revenue.totalRevenue + workerSubscriptionRevenue,
          bookingRevenue: revenue.totalRevenue,
          workerSubscriptionRevenue,
          platformCommission,
          pendingVendors,
          approvedVendors,
          pendingWithdrawals,
          pendingSettlements: pendingSettlementsCount,
          pendingScraps
        },
        recentBookings
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats. Please try again.'
    });
  }
};

/**
 * Get revenue analytics
 */
const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;

    let groupFormat = '%Y-%m';
    if (period === 'daily') {
      groupFormat = '%Y-%m-%d';
    } else if (period === 'weekly') {
      groupFormat = '%Y-%W';
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.completedAt = {};
      if (startDate) dateFilter.completedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.completedAt.$lte = new Date(endDate);
    }

    const [commissionData, revenueData, subscriptionData] = await Promise.all([
      getCommissionRates(),
      Booking.aggregate([
        {
          $match: {
            status: { $in: [BOOKING_STATUS.COMPLETED, 'completed'] },
            paymentStatus: {
              $in: [
                PAYMENT_STATUS.SUCCESS,
                PAYMENT_STATUS.COLLECTED_BY_VENDOR,
                'success',
                'collected_by_vendor',
                'collected_by_worker',
                'paid'
              ]
            },
            ...dateFilter
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: groupFormat,
                date: '$completedAt'
              }
            },
            revenue: { $sum: '$finalAmount' },
            bookings: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Transaction.aggregate([
        {
          $match: {
            type: 'worker_subscription',
            status: 'completed',
            ...(dateFilter.completedAt ? { createdAt: dateFilter.completedAt } : {})
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: groupFormat,
                date: '$createdAt'
              }
            },
            revenue: { $sum: '$amount' },
            bookings: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const { platformShare } = commissionData || { platformShare: 0.1 };

    // Merge data
    const mergedData = {};
    (revenueData || []).forEach(item => {
      mergedData[item._id] = {
        date: item._id,
        revenue: item.revenue || 0,
        bookings: item.bookings || 0,
        platformCommission: (item.revenue || 0) * platformShare
      };
    });

    (subscriptionData || []).forEach(item => {
      if (mergedData[item._id]) {
        mergedData[item._id].revenue += (item.revenue || 0);
      } else {
        mergedData[item._id] = {
          date: item._id,
          revenue: item.revenue || 0,
          bookings: 0,
          platformCommission: item.revenue || 0
        };
      }
    });

    const finalResult = Object.values(mergedData).sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
      success: true,
      data: {
        period,
        revenueData: finalResult
      }
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics. Please try again.'
    });
  }
};

/**
 * Get booking trends
 */
const getBookingTrends = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Daily booking trends
    const trends = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', BOOKING_STATUS.COMPLETED] }, 1, 0]
            }
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', BOOKING_STATUS.CANCELLED] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        days: parseInt(days),
        trends
      }
    });
  } catch (error) {
    console.error('Get booking trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking trends. Please try again.'
    });
  }
};

/**
 * Get user growth metrics
 */
const getUserGrowthMetrics = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // User growth
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Vendor growth
    const vendorGrowth = await Vendor.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        days: parseInt(days),
        userGrowth,
        vendorGrowth
      }
    });
  } catch (error) {
    console.error('Get user growth metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user growth metrics. Please try again.'
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueAnalytics,
  getBookingTrends,
  getUserGrowthMetrics
};

