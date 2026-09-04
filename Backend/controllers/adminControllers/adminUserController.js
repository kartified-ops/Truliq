const User = require('../../models/User');
const Booking = require('../../models/Booking');
const { validationResult } = require('express-validator');

/**
 * Get all users with filters and pagination (including Deleted Users)
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      search,
      status, // 'all', 'active', 'inactive', 'deleted'
      isActive,
      isDeleted,
      isPhoneVerified,
      isEmailVerified,
      page = 1,
      limit = 20
    } = req.query;

    // Build query
    const query = { role: 'user' };

    if (status === 'deleted' || isDeleted === 'true') {
      query.isDeleted = true;
    } else if (status === 'active') {
      query.isActive = true;
      query.isDeleted = { $ne: true };
    } else if (status === 'inactive') {
      query.isActive = false;
      query.isDeleted = { $ne: true };
    } else {
      // status === 'all' or not specified
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }
    }

    if (isPhoneVerified !== undefined) {
      query.isPhoneVerified = isPhoneVerified === 'true';
    }
    if (isEmailVerified !== undefined) {
      query.isEmailVerified = isEmailVerified === 'true';
    }

    // Search by name, phone, email, or original contacts
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { originalPhone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { originalEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get users
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Clean up display contact numbers/emails for deleted accounts
    const formattedUsers = users.map((u) => ({
      ...u,
      displayPhone: u.originalPhone || (u.phone?.startsWith('deleted_') ? u.phone.split('_').slice(2).join('_') : u.phone),
      displayEmail: u.originalEmail || (u.email?.startsWith('deleted_') ? u.email.split('_').slice(2).join('_') : u.email),
      phone: u.originalPhone || (u.phone?.startsWith('deleted_') ? u.phone.split('_').slice(2).join('_') : u.phone),
      email: u.originalEmail || (u.email?.startsWith('deleted_') ? u.email.split('_').slice(2).join('_') : u.email),
    }));

    // Get total count
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: formattedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users. Please try again.'
    });
  }
};

/**
 * Get user details
 */
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user booking stats
    const bookingStats = await Booking.aggregate([
      {
        $match: { userId: user._id }
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          completedBookings: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          totalSpent: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'success'] },
                '$finalAmount',
                0
              ]
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        user,
        stats: bookingStats[0] || {
          totalBookings: 0,
          completedBookings: 0,
          totalSpent: 0
        }
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details. Please try again.'
    });
  }
};

/**
 * Block/unblock user
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = isActive !== undefined ? isActive : !user.isActive;
    if (!user.isActive) {
      user.loginSessionId = null; // Invalidate active sessions immediately
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'blocked'} successfully`,
      data: user
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status. Please try again.'
    });
  }
};

/**
 * Delete user (Soft delete - preserves data & history for admin)
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const now = new Date();
    const originalPhone = user.originalPhone || user.phone;
    const originalEmail = user.originalEmail || user.email;

    // Soft delete
    user.isDeleted = true;
    user.deletedAt = now;
    user.deleteReason = req.body?.reason || 'Deleted by admin';
    user.isActive = false;
    user.originalPhone = originalPhone;
    user.originalEmail = originalEmail || null;
    user.phone = `deleted_${now.getTime()}_${originalPhone}`;
    if (user.email) {
      user.email = `deleted_${now.getTime()}_${originalEmail}`;
    }
    user.fcmTokens = [];
    user.fcmTokenMobile = [];
    user.loginSessionId = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully (history preserved)'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user. Please try again.'
    });
  }
};

/**
 * View user bookings
 */
const getUserBookings = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    // Build query
    const query = { userId: id };
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bookings
    const bookings = await Booking.find(query)
      .populate('vendorId', 'name businessName')
      .populate('serviceId', 'title iconUrl')
      .populate('workerId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user bookings. Please try again.'
    });
  }
};

/**
 * View user wallet transactions
 */
const getUserWalletTransactions = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('wallet');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get wallet transactions from bookings
    const transactions = await Booking.find({
      userId: id,
      paymentMethod: 'wallet',
      paymentStatus: 'success'
    })
      .select('bookingNumber finalAmount createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: {
        balance: user.wallet.balance || 0,
        transactions
      }
    });
  } catch (error) {
    console.error('Get user wallet transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet transactions. Please try again.'
    });
  }
};

/**
 * Get all user bookings with filters and pagination
 */
const getAllUserBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    // Search by user name or phone
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      query.userId = { $in: userIds };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(query)
      .populate('userId', 'name phone email')
      .populate('workerId', 'name phone')
      .populate('serviceId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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
    console.error('Get all user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user bookings'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserDetails,
  toggleUserStatus,
  deleteUser,
  getUserBookings,
  getUserWalletTransactions,
  getAllUserBookings
};

