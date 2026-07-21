const mongoose = require('mongoose');
const Category = require('./models/Category');
const Brand = require('./models/Brand');

const connectDB = async () => {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/homster', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    // Count Active Categories
    const globalCount = await Category.countDocuments({ 
        status: { $ne: 'deleted' }, 
        $or: [{ cityIds: { $size: 0 } }, { cityIds: { $exists: false } }] 
    });
    
    const citySpecificCount = await Category.countDocuments({ 
        status: { $ne: 'deleted' }, 
        cityIds: { $exists: true, $not: { $size: 0 } } 
    });

    // Count Active Brands
    const globalBrandsCount = await Brand.countDocuments({ 
        status: { $ne: 'deleted' }, 
        $or: [{ cityIds: { $size: 0 } }, { cityIds: { $exists: false } }] 
    });
    
    const citySpecificBrandsCount = await Brand.countDocuments({ 
        status: { $ne: 'deleted' }, 
        cityIds: { $exists: true, $not: { $size: 0 } } 
    });

    console.log(`\n============================`);
    console.log(`       ACTIVE ITEMS        `);
    console.log(`============================\n`);

    console.log(`--- CATEGORIES ---`);
    console.log(`Global Categories:        ${globalCount}`);
    console.log(`City-Specific Categories: ${citySpecificCount}`);
    console.log(`------------------------`);
    console.log(`Total Categories:         ${globalCount + citySpecificCount}\n`);
    
    console.log(`--- BRANDS ---`);
    console.log(`Global Brands:            ${globalBrandsCount}`);
    console.log(`City-Specific Brands:     ${citySpecificBrandsCount}`);
    console.log(`------------------------`);
    console.log(`Total Brands:             ${globalBrandsCount + citySpecificBrandsCount}\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

connectDB();
