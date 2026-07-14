const Booking = require('../../models/Booking');
const Worker = require('../../models/Worker');
const { BOOKING_STATUS } = require('../../utils/constants');

/**
 * Get worker dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    const workerId = req.user.id;

    // Get Worker Profile for Rating (fallback)
    const worker = await Worker.findById(workerId).lean();

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Run all aggregations and counts in parallel
    const [
      earningStats,
      pendingJobsCount,
      activeJobsCount,
      completedJobsCount,
      ratingStats,
      recentJobs
    ] = await Promise.all([
      // 2. Calculate Total Earnings
      Booking.aggregate([
        {
          $match: {
            workerId: worker._id,
            status: { $in: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.WORK_DONE] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$finalAmount" }
          }
        }
      ]),

      // 3. Count Pending Jobs
      Booking.countDocuments({
        workerId: worker._id,
        status: {
          $in: [
            BOOKING_STATUS.ASSIGNED,
            BOOKING_STATUS.CONFIRMED,
            'PENDING'
          ]
        }
      }),

      // 3.5 Count Active Jobs
      Booking.countDocuments({
        workerId: worker._id,
        status: {
          $in: [
            BOOKING_STATUS.VISITED,
            BOOKING_STATUS.IN_PROGRESS,
            BOOKING_STATUS.WORK_DONE,
            'STARTED',
            'REACHED',
            'ON_THE_WAY'
          ]
        }
      }),

      // 4. Count Completed Jobs
      Booking.countDocuments({
        workerId: worker._id,
        status: { $in: [BOOKING_STATUS.COMPLETED, 'WORKER_PAID', 'PAID'] }
      }),

      // 5. Calculate Average Rating
      Booking.aggregate([
        {
          $match: {
            workerId: worker._id,
            rating: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" }
          }
        }
      ]),

      // 6. Get Recent Jobs
      Booking.find({ workerId: worker._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name')
        .populate('serviceId', 'title')
        .lean()
    ]);

    const totalEarnings = earningStats.length > 0 ? earningStats[0].total : 0;
    const averageRating = ratingStats.length > 0 ? parseFloat(ratingStats[0].avgRating.toFixed(1)) : (worker.rating || 0);

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        pendingJobs: pendingJobsCount,
        activeJobs: activeJobsCount,
        completedJobs: completedJobsCount,
        rating: averageRating,
        recentJobs
      }
    });

  } catch (error) {
    console.error('Get worker dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

module.exports = {
  getDashboardStats
};
