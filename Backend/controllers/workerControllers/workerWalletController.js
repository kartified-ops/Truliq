const Worker = require('../../models/Worker');
const Transaction = require('../../models/Transaction');
const Booking = require('../../models/Booking');
const { createOrder, verifyPayment } = require('../../services/razorpayService');
const PlatformEarning = require('../../models/PlatformEarning');

/**
 * Get worker wallet with ledger balance
 */
const getWallet = async (req, res) => {
  try {
    const workerId = req.user.id;
    const worker = await Worker.findById(workerId).lean();

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    // List of bookings pending payment (excluding cash collected and direct worker bookings)
    const pendingBookings = await Booking.find({
      workerId: workerId,
      status: 'completed', // Only completed jobs
      workerPaymentStatus: 'PENDING',
      paymentMethod: { $nin: ['cash', 'hand_to_hand'] },
      cashCollected: { $ne: true },
      vendorId: { $ne: null } // Exclude direct worker bookings
    })
      .select('bookingNumber serviceName completedAt vendorId finalAmount vendorBillId')
      .sort({ completedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        balance: worker.wallet?.balance || 0,
        dues: worker.wallet?.dues || 0,
        cashLimit: worker.wallet?.cashLimit || 10000,
        isBlocked: worker.wallet?.isBlocked || false,
        pendingBookings: pendingBookings
      }
    });

  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch wallet info' });
  }
};

/**
 * Get worker transactions
 */
const getTransactions = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;

    const query = { workerId };

    // Filter by type if provided
    if (type && type !== 'all') {
      query.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Run find and count in parallel for faster response
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
};

const { sendPushNotification } = require('../../services/firebaseAdmin');

/**
 * Request payout from vendor for a specific booking
 */
const requestPayout = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { bookingId } = req.body;
    const worker = await Worker.findById(workerId);

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      workerId: workerId,
      status: 'completed',
      workerPaymentStatus: 'PENDING'
    }).populate('vendorId'); // Ensure vendor is populated to access tokens

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found or already paid' });
    }

    if (!booking.vendorId) {
      return res.status(400).json({ success: false, message: 'No vendor associated with this booking' });
    }

    const vendor = booking.vendorId;
    const message = `Worker ${worker.name} has requested payment for Booking #${booking.bookingNumber}.`;
    const title = '💸 Payout Request';

    // Use createNotification helper for proper notification delivery
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      vendorId: vendor._id,
      type: 'payout_requested',
      title: title,
      message: message,
      relatedId: booking._id,
      relatedType: 'booking',
      priority: 'high',
      pushData: {
        type: 'payout_requested',
        bookingId: booking._id.toString(),
        link: `/vendor/booking/${booking._id}`
      }
    });

    res.status(200).json({ success: true, message: 'Payment request sent to vendor' });

  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ success: false, message: 'Failed to send payout request' });
  }
};

const Withdrawal = require('../../models/Withdrawal');

/**
 * Request withdrawal of entire wallet balance to admin
 */
const requestWithdrawal = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { amount, bankDetails } = req.body;

    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    if (worker.wallet.balance < withdrawAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Check for existing pending withdrawal
    const existingPending = await Withdrawal.findOne({ 
      workerId, 
      status: 'pending' 
    });
    
    if (existingPending) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have a pending withdrawal request' 
      });
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      workerId,
      amount: withdrawAmount,
      bankDetails: bankDetails || worker.bankDetails, // Use provided or saved bank details
      status: 'pending',
      requestDate: new Date()
    });

    // Notify Admin
    const { createNotification } = require('../notificationControllers/notificationController');
    await createNotification({
      type: 'withdrawal_requested',
      title: '💰 New Withdrawal Request',
      message: `Worker ${worker.name} has requested a withdrawal of ₹${withdrawAmount}.`,
      relatedId: withdrawal._id,
      relatedType: 'withdrawal',
      priority: 'high'
    });

    res.status(200).json({ 
      success: true, 
      message: 'Withdrawal request submitted successfully',
      data: withdrawal
    });

  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit withdrawal request' });
  }
};

/**
 * Create a Razorpay order to pay platform dues
 */
const createDuesPaymentOrder = async (req, res) => {
  try {
    const workerId = req.user.id;
    const worker = await Worker.findById(workerId);
    
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const duesAmount = worker.wallet?.dues || 0;
    
    if (duesAmount <= 0) {
      return res.status(400).json({ success: false, message: 'You do not have any pending dues to pay' });
    }

    // Minimum amount for Razorpay is usually ₹1 (100 paise)
    if (duesAmount < 1) {
      return res.status(400).json({ success: false, message: 'Dues amount is too small to process online' });
    }

    // Create Razorpay order
    const orderResult = await createOrder(duesAmount, `Dues payment for worker ${worker.name}`);
    
    if (!orderResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: orderResult.orderId,
        amount: duesAmount,
        currency: 'INR'
      }
    });
  } catch (error) {
    console.error('Create dues order error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate payment' });
  }
};

/**
 * Verify Razorpay payment and clear dues
 */
const verifyDuesPayment = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification details' });
    }

    const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    const paidAmount = worker.wallet?.dues || 0;
    
    // Clear dues
    worker.wallet.dues = 0;
    
    // Check if worker was blocked due to dues limit, then unblock
    if (worker.wallet.isBlocked && worker.wallet.dues <= worker.wallet.cashLimit) {
      worker.wallet.isBlocked = false;
      worker.wallet.blockedAt = null;
      worker.wallet.blockReason = null;
    }
    
    await worker.save();

    // Create a transaction record for this payment
    const transaction = await Transaction.create({
      workerId: worker._id,
      type: 'settlement',
      amount: paidAmount, // The amount worker paid to admin
      description: `Paid platform dues via Razorpay`,
      status: 'completed',
      metadata: {
        paymentMethod: 'razorpay',
        transactionId: razorpay_payment_id,
        orderId: razorpay_order_id,
        notes: 'Worker cleared their platform dues'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Dues paid successfully',
      data: {
        transactionId: transaction._id,
        amount: paidAmount,
        dues: worker.wallet.dues,
        isBlocked: worker.wallet.isBlocked
      }
    });

  } catch (error) {
    console.error('Verify dues payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

module.exports = {
  getWallet,
  getTransactions,
  requestPayout,
  requestWithdrawal,
  createDuesPaymentOrder,
  verifyDuesPayment
};
