const mongoose = require('mongoose');
const Category = require('./models/Category');
const Brand = require('./models/Brand');

// Connect to DB directly for this script
const connectDB = async () => {
  try {
    // We assume the .env file is in the Backend folder
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/homster', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');

    // Fix Categories
    const deletedCategories = await Category.find({ status: 'deleted' });
    console.log(`Found ${deletedCategories.length} deleted categories.`);
    for (let cat of deletedCategories) {
      if (!cat.slug.includes('-deleted-')) {
        cat.slug = `${cat.slug}-deleted-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await cat.save();
        console.log(`Updated category slug to: ${cat.slug}`);
      }
    }

    // Fix Brands
    const deletedBrands = await Brand.find({ status: 'deleted' });
    console.log(`Found ${deletedBrands.length} deleted brands.`);
    for (let brand of deletedBrands) {
      if (!brand.slug.includes('-deleted-')) {
        brand.slug = `${brand.slug}-deleted-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await brand.save();
        console.log(`Updated brand slug to: ${brand.slug}`);
      }
    }

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

connectDB();
