const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const users = await User.find({
    $or: [
      { email: 'devendra7jaiswal@gmail.com' },
      { phone: '6266925739' },
      { phone: '+91 6266925739' }
    ]
  }).select('name email phone');

  console.log('Users found:', users);
  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
