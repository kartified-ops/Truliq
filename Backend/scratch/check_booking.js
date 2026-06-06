const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Booking = require('../models/Booking');

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.log('No MONGODB_URI found in env');
      return;
    }
    await mongoose.connect(mongoUri);
    const booking = await Booking.findById('6a211f826fafe9beed37fbf6');
    console.log('Booking details:', JSON.stringify(booking, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}

run();
