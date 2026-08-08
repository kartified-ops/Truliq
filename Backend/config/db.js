const mongoose = require('mongoose');

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    if (error.name === 'MongooseServerSelectionError' || error.message.includes('connect ECONNREFUSED') || error.message.includes('querySrv ETIMEOUT')) {
      console.error('💡 TIP: If you switched networks (e.g., Office Wi-Fi), make sure your IP is whitelisted in MongoDB Atlas (Network Access -> Add 0.0.0.0/0).');
    }
    process.exit(1);
  }
};

module.exports = connectDB;

