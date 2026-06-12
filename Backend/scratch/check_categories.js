const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Category = require('../models/Category');
const City = require('../models/City');

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    console.log('Connecting to DB...');
    await mongoose.connect(uri);
    console.log('Connected.');

    const city = await City.findOne({ name: { $regex: /indore/i } });
    if (!city) {
      console.log('City Indore not found!');
    } else {
      console.log(`Found City: ${city.name} (${city._id})`);
    }

    const cityId = city ? city._id : null;

    // Simulate catalogController getPublicCategories query
    const activeQuery = { status: 'active' };
    if (cityId) {
      activeQuery.$or = [
        { cityIds: cityId },
        { cityIds: { $size: 0 } },
        { cityIds: { $exists: false } }
      ];
    }
    
    const activeCats = await Category.find(activeQuery).select('title status').lean();
    console.log(`\nActive categories for Indore: ${activeCats.length}`);

    // Fetch all categories to see their ACTUAL statuses
    const allQuery = {};
    if (cityId) {
      allQuery.$or = [
        { cityIds: cityId },
        { cityIds: { $size: 0 } },
        { cityIds: { $exists: false } }
      ];
    }
    const allCats = await Category.find(allQuery).select('title status').lean();
    console.log(`\nALL categories for Indore (any status): ${allCats.length}`);
    console.log(allCats);

  } catch (error) {
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

run();
