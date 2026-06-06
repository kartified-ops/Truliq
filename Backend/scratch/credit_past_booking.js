const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Booking = require('../models/Booking');
const Worker = require('../models/Worker');
const VendorBill = require('../models/VendorBill');
const Transaction = require('../models/Transaction');

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.log('No MONGODB_URI found in env');
      return;
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const bookingId = '6a210cff8e1949754fc9e59d';
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      console.log(`Booking with ID ${bookingId} not found`);
      return;
    }

    console.log('Booking found:', booking.bookingNumber, 'status:', booking.status, 'paymentStatus:', booking.paymentStatus);

    if (!booking.workerId) {
      console.log('This booking has no worker assigned');
      return;
    }

    const worker = await Worker.findById(booking.workerId);
    if (!worker) {
      console.log('Worker not found');
      return;
    }

    console.log('Current worker wallet details:', worker.wallet);

    const bill = await VendorBill.findOne({ bookingId: booking._id });
    if (!bill) {
      console.log('No bill found for this booking');
      return;
    }

    const amountToCredit = bill.grandTotal || booking.finalAmount || 505;
    console.log(`Amount to credit: ₹${amountToCredit}`);

    // Check if transaction already exists to avoid duplicate credits
    const existingTx = await Transaction.findOne({
      workerId: booking.workerId,
      bookingId: booking._id,
      type: 'earnings_credit'
    });

    if (existingTx) {
      console.log('Earnings already credited for this booking in transactions:', existingTx._id);
    } else {
      // Increment worker's earnings and balance
      worker.wallet.earnings = (worker.wallet.earnings || 0) + amountToCredit;
      worker.wallet.balance = (worker.wallet.balance || 0) + amountToCredit;
      await worker.save();
      console.log('Updated worker wallet details:', worker.wallet);

      // Create earnings credit transaction
      const tx = await Transaction.create({
        workerId: booking.workerId,
        bookingId: booking._id,
        amount: amountToCredit,
        type: 'earnings_credit',
        paymentMethod: 'system',
        status: 'completed',
        description: `Earnings ₹${amountToCredit} credited for booking ${booking.bookingNumber} (online payment fix)`,
        metadata: {
          type: 'earnings_increase',
          billId: bill._id.toString()
        }
      });
      console.log('Transaction record created successfully:', tx._id);
    }

  } catch (err) {
    console.error('Error running script:', err);
  } finally {
    await mongoose.connection.close();
    console.log('DB connection closed');
  }
}

run();
