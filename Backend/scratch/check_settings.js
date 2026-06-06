const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Settings = require('../models/Settings');

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('dotenv path:', path.resolve(__dirname, '../.env'));
    console.log('MONGODB_URI from env:', mongoUri);
    if (!mongoUri) {
      console.log('No MONGODB_URI found in env');
      return;
    }
    await mongoose.connect(mongoUri);
    const settings = await Settings.findOne({ type: 'global' });
    console.log('Global settings in DB:', JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}

run();
