const Category = require('../../models/Category');
const Brand = require('../../models/Brand');
const Service = require('../../models/UserService');
const HomeContent = require('../../models/HomeContent');

/**
 * Public Catalog Controllers
 * These endpoints are accessible without authentication for user app
 */

/**
 * Get all active categories for user app
 * GET /api/public/categories
 */
const getPublicCategories = async (req, res) => {
  try {
    const { cityId } = req.query;

    const query = { status: 'active' };
    if (cityId) {
      query.$or = [
        { cityIds: cityId },
        { cityIds: { $size: 0 } },
        { cityIds: { $exists: false } }
      ];
    }

    const categories = await Category.find(query)
      .select('title slug homeIconUrl homeBadge hasSaleBadge homeOrder showOnHome')
      .sort({ homeOrder: 1, createdAt: -1 })
      .lean();

    // Fetch only necessary fields for initial category list
    const initialCategories = categories.map(cat => ({
      id: cat._id.toString(),
      title: cat.title,
      slug: cat.slug,
      icon: cat.homeIconUrl || '',
      badge: cat.homeBadge || '',
      hasSaleBadge: cat.hasSaleBadge || false,
      showOnHome: cat.showOnHome || false
    }));

    res.status(200).json({
      success: true,
      categories: initialCategories
    });
  } catch (error) {
    console.error('Get public categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories. Please try again.'
    });
  }
};

/**
 * Get all active brands for user app (Formerly Services)
 * GET /api/public/brands
 */
const getPublicBrands = async (req, res) => {
  try {
    const { categoryId, categorySlug, search, cityId } = req.query;

    // Build query
    const query = { status: 'active' };
    if (categoryId) {
      query.$or = [
        { categoryIds: categoryId },
        { categoryId: categoryId }
      ];
    }
    if (cityId) {
      query.$or = [
        { cityIds: cityId },
        { cityIds: { $size: 0 } },
        { cityIds: { $exists: false } }
      ];
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.title = { $regex: '^' + escapedSearch, $options: 'i' };
    }

    let brands = await Brand.find(query)
      .select('title slug iconUrl logo imageUrl badge categoryIds categoryId basePrice discountPrice')
      .sort({ createdAt: -1 })
      .lean();

    // If categorySlug is provided, filter by category
    if (categorySlug) {
      const catQuery = { slug: categorySlug, status: 'active' };
      if (cityId) {
        catQuery.cityIds = cityId;
      }

      let category = await Category.findOne(catQuery).lean();

      if (!category && cityId) {
        category = await Category.findOne({ slug: categorySlug, status: 'active' }).lean();
      }

      if (category) {
        brands = brands.filter(b => {
          const ids = [
            ...(Array.isArray(b.categoryIds) ? b.categoryIds.map(id => id.toString()) : []),
            ...(b.categoryId ? [b.categoryId.toString()] : [])
          ];
          return ids.includes(category._id.toString());
        });
      }
    }

    res.status(200).json({
      success: true,
      brands: brands.map(brand => ({
        id: brand._id.toString(),
        title: brand.title,
        slug: brand.slug,
        icon: brand.iconUrl || '',
        logo: brand.logo || brand.iconUrl || '',
        imageUrl: brand.imageUrl || brand.iconUrl || '',
        badge: brand.badge || '',
        price: brand.basePrice || 0, // Legacy support
        originalPrice: brand.discountPrice ? (brand.basePrice + brand.discountPrice) : (brand.basePrice || 0),
        categoryId: (brand.categoryIds && brand.categoryIds.length > 0) ? brand.categoryIds[0].toString() : (brand.categoryId ? brand.categoryId.toString() : null),
        categoryIds: (brand.categoryIds || []).map(id => id.toString())
      }))
    });
  } catch (error) {
    console.error('Get public brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brands. Please try again.'
    });
  }
};

/**
 * Get brand by slug for user app
 * GET /api/public/brands/slug/:slug
 */
const getPublicBrandBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const brand = await Brand.findOne({ slug, status: 'active' })
      .populate('categoryIds', 'title slug')
      .lean();

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Remove _id from nested objects
    const cleanBrand = JSON.parse(JSON.stringify(brand));
    const removeIds = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(item => {
          if (item && typeof item === 'object') {
            const { _id, ...rest } = item;
            return removeIds(rest);
          }
          return item;
        });
      } else if (obj && typeof obj === 'object') {
        const { _id, ...rest } = obj;
        return Object.keys(rest).reduce((acc, key) => {
          acc[key] = removeIds(rest[key]);
          return acc;
        }, {});
      }
      return obj;
    };

    // Fetch services associated with this brand
    const brandServices = await Service.find({ brandId: brand._id, status: 'active' }).lean();

    // Map services to a default section structure for the frontend
    const servicesSection = {
      title: brand.title,
      subtitle: 'Available Services',
      cards: brandServices.map(svc => ({
        id: svc._id.toString(),
        title: svc.title,
        subtitle: svc.description || '',
        price: svc.basePrice,
        pricingUnit: svc.pricingUnit,
        rating: "4.8", // Default rating
        reviews: "1k+", // Default reviews
        imageUrl: svc.iconUrl || brand.iconUrl || '',
        features: svc.description ? [svc.description] : [],
        duration: "60 min" // Default duration
      }))
    };

    const formattedBrand = {
      id: brand._id.toString(),
      title: brand.title,
      slug: brand.slug,
      icon: brand.iconUrl || '',
      logo: brand.logo || '',
      badge: brand.badge || '',
      basePrice: brand.basePrice, // Legacy
      category: brand.categoryIds && brand.categoryIds[0] ? {
        id: brand.categoryIds[0]._id.toString(),
        title: brand.categoryIds[0].title,
        slug: brand.categoryIds[0].slug
      } : null,
      categories: (brand.categoryIds || []).map(cat => ({
        id: cat._id.toString(),
        title: cat.title,
        slug: cat.slug
      })),
      page: brand.page ? removeIds(brand.page) : {
        banners: brand.iconUrl ? [{ imageUrl: brand.iconUrl, text: brand.title }] : [],
        paymentOffers: [],
        paymentOffersEnabled: false
      },
      sections: brandServices.length > 0 ? [servicesSection] : []
    };

    res.status(200).json({
      success: true,
      brand: formattedBrand
    });
  } catch (error) {
    console.error('Get public brand by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brand. Please try again.'
    });
  }
};

/**
 * Get services based on brand
 * GET /api/public/services
 */
const getPublicServices = async (req, res) => {
  try {
    const { brandId, brandSlug, categoryId } = req.query;

    const query = { status: 'active' };

    if (brandId) {
      query.brandId = brandId;
      if (categoryId && categoryId !== 'custom') {
        query.$or = [
          { categoryId: categoryId },
          { categoryId: { $exists: false } },
          { categoryId: null }
        ];
      }
    } else if (brandSlug) {
      const brand = await Brand.findOne({ slug: brandSlug });
      if (brand) {
        query.brandId = brand._id;
      } else {
        return res.status(200).json({ success: true, services: [] });
      }
    } else if (categoryId && categoryId !== 'custom') {
      // If no brandId, fetch services by categoryId OR services belonging to brands of this category
      const categoryBrands = await Brand.find({
        $or: [
          { categoryIds: categoryId },
          { categoryId: categoryId }
        ]
      }).select('_id');
      const brandIds = categoryBrands.map(b => b._id);

      query.$or = [
        { categoryId: categoryId },
        { brandId: { $in: brandIds } }
      ];
    }

    if (req.query.search) {
      const escapedSearch = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.title = { $regex: '^' + escapedSearch, $options: 'i' };
    }

    const services = await Service.find(query)
      .populate('brandId', 'title iconUrl')
      .sort({ createdAt: 1 })
      .lean();

    let resultServices = services.map(svc => ({
      id: svc._id.toString(),
      title: svc.title,
      slug: svc.slug,
      icon: svc.iconUrl,
      basePrice: svc.basePrice,
      discountPrice: svc.discountPrice,
      gstPercentage: svc.gstPercentage,
      pricingUnit: svc.pricingUnit,
      description: svc.description,
      categoryId: svc.categoryId?.toString(),
      brandId: svc.brandId?._id,
      brandName: svc.brandId?.title,
      brandIcon: svc.brandId?.iconUrl
    }));

    // Fallback: If no sub-services found in UserService collection, check matching Brands or Brand sections
    if (resultServices.length === 0 && (brandId || categoryId)) {
      const brandFilter = {};
      if (brandId) {
        brandFilter._id = brandId;
      } else if (categoryId && categoryId !== 'custom') {
        brandFilter.$or = [
          { categoryIds: categoryId },
          { categoryId: categoryId }
        ];
      }

      const matchingBrands = await Brand.find(brandFilter).lean();

      for (const brand of matchingBrands) {
        // If brand has embedded sections with cards (legacy/seeded structure)
        if (Array.isArray(brand.sections) && brand.sections.length > 0) {
          for (const section of brand.sections) {
            if (Array.isArray(section.cards) && section.cards.length > 0) {
              for (const card of section.cards) {
                resultServices.push({
                  id: card.id || card._id?.toString() || `${brand._id}-${card.title}`,
                  title: card.title,
                  slug: brand.slug,
                  icon: card.imageUrl || brand.iconUrl || brand.logo || '',
                  basePrice: Number(card.price) || brand.basePrice || 0,
                  discountPrice: card.originalPrice ? Number(card.price) : null,
                  pricingUnit: card.duration || brand.pricingUnit || '',
                  description: card.subtitle || card.description || '',
                  categoryId: categoryId || (brand.categoryIds?.[0]?.toString()),
                  brandId: brand._id.toString(),
                  brandName: brand.title,
                  brandIcon: brand.iconUrl || brand.logo
                });
              }
            }
          }
        } else {
          // If brand itself acts as a service
          resultServices.push({
            id: brand._id.toString(),
            title: brand.title,
            slug: brand.slug,
            icon: brand.iconUrl || brand.logo || brand.imageUrl || '',
            basePrice: brand.basePrice || brand.price || 0,
            discountPrice: brand.discountPrice || null,
            pricingUnit: brand.pricingUnit || '',
            description: brand.description || '',
            categoryId: categoryId || (brand.categoryIds?.[0]?.toString()),
            brandId: brand._id.toString(),
            brandName: brand.title,
            brandIcon: brand.iconUrl || brand.logo
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      services: resultServices
    });
  } catch (error) {
    console.error('Get public services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services'
    });
  }
};

/**
 * Get home content
 */
const getPublicHomeContent = async (req, res) => {
  try {
    const { cityId } = req.query;
    const homeContent = await HomeContent.getHomeContent(cityId);

    if (!homeContent) {
      return res.status(200).json({
        success: true,
        homeContent: {
          banners: [],
          promos: [],
          curated: [],
          noteworthy: [],
          booked: [],
          categorySections: []
        }
      });
    }

    // Used for backwards compatibility, we might need to update this to refer to Brands?
    // For now keeping as is, but assuming targetServiceId will point to Brand ID essentially.

    const contentObj = homeContent.toObject();

    const formattedContent = {
      banners: (contentObj.banners || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      promos: (contentObj.promos || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      curated: (contentObj.curated || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      noteworthy: (contentObj.noteworthy || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      booked: (contentObj.booked || []).map(item => ({
        ...item,
        id: item._id ? item._id.toString() : item.id,
        targetCategoryId: item.targetCategoryId?.toString() || null,
        targetServiceId: item.targetServiceId?.toString() || null,
      })),
      categorySections: (contentObj.categorySections || []).map(section => ({
        ...section,
        id: section._id ? section._id.toString() : section.id,
        seeAllTargetCategoryId: section.seeAllTargetCategoryId?.toString() || null,
        seeAllTargetServiceId: section.seeAllTargetServiceId?.toString() || null,
        cards: (section.cards || []).map(card => ({
          ...card,
          id: card._id ? card._id.toString() : card.id,
          targetCategoryId: card.targetCategoryId?.toString() || null,
          targetServiceId: card.targetServiceId?.toString() || null,
        }))
      })),
      isBannersVisible: contentObj.isBannersVisible ?? true,
      isPromosVisible: contentObj.isPromosVisible ?? true,
      isCuratedVisible: contentObj.isCuratedVisible ?? true,
      isNoteworthyVisible: contentObj.isNoteworthyVisible ?? true,
      isBookedVisible: contentObj.isBookedVisible ?? true,
      isCategorySectionsVisible: contentObj.isCategorySectionsVisible ?? true,
      isCategoriesVisible: contentObj.isCategoriesVisible ?? true
    };

    res.status(200).json({
      success: true,
      homeContent: formattedContent
    });

  } catch (error) {
    console.error('Get public home content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home content. Please try again.'
    });
  }
};

/**
 * Get consolidated home data (Categories + Content)
 */
const getPublicHomeData = async (req, res) => {
  try {
    const { cityId } = req.query;

    // Fetch both in parallel
    const [categoriesRes, homeContent] = await Promise.all([
      Category.find({ 
        status: 'active', 
        ...(cityId ? {
          $or: [
            { cityIds: cityId },
            { cityIds: { $size: 0 } },
            { cityIds: { $exists: false } }
          ]
        } : {}) 
      })
        .select('title slug homeIconUrl homeBadge hasSaleBadge showOnHome')
        .sort({ homeOrder: 1 })
        .lean(),
      HomeContent.getHomeContent(cityId)
    ]);

    const formattedCategories = categoriesRes.map(cat => ({
      id: cat._id.toString(),
      title: cat.title,
      slug: cat.slug,
      icon: cat.homeIconUrl || '',
      badge: cat.homeBadge || '',
      hasSaleBadge: cat.hasSaleBadge || false,
      showOnHome: cat.showOnHome !== false // default to true if undefined
    }));

    let formattedContent = null;
    if (homeContent) {
      const contentObj = homeContent.toObject();
      formattedContent = {
        banners: (contentObj.banners || []).map(item => ({
          imageUrl: item.imageUrl,
          targetCategoryId: item.targetCategoryId?.toString() || null,
          slug: item.slug,
          order: item.order
        })),
        promos: (contentObj.promos || []).map(item => ({
          title: item.title,
          subtitle: item.subtitle,
          imageUrl: item.imageUrl,
          targetCategoryId: item.targetCategoryId?.toString() || null,
          order: item.order
        })),
        curated: (contentObj.curated || []).map(item => ({
          title: item.title,
          gifUrl: item.gifUrl,
          youtubeUrl: item.youtubeUrl,
          order: item.order
        })),
        noteworthy: (contentObj.noteworthy || []).map(item => ({
          title: item.title,
          imageUrl: item.imageUrl,
          targetCategoryId: item.targetCategoryId?.toString() || null,
          order: item.order
        })),
        booked: (contentObj.booked || []).map(item => ({
          title: item.title,
          rating: item.rating,
          price: item.price,
          imageUrl: item.imageUrl,
          targetCategoryId: item.targetCategoryId?.toString() || null,
          order: item.order
        })),
        categorySections: (contentObj.categorySections || []).map(section => ({
          title: section.title,
          seeAllTargetCategoryId: section.seeAllTargetCategoryId?.toString() || null,
          cards: (section.cards || []).map(card => ({
            title: card.title,
            imageUrl: card.imageUrl,
            price: card.price,
            rating: card.rating,
            targetCategoryId: card.targetCategoryId?.toString() || null
          })),
          order: section.order
        })),
        isBannersVisible: contentObj.isBannersVisible ?? true,
        isPromosVisible: contentObj.isPromosVisible ?? true,
        isCuratedVisible: contentObj.isCuratedVisible ?? true,
        isNoteworthyVisible: contentObj.isNoteworthyVisible ?? true,
        isBookedVisible: contentObj.isBookedVisible ?? true,
        isCategorySectionsVisible: contentObj.isCategorySectionsVisible ?? true,
        isCategoriesVisible: contentObj.isCategoriesVisible ?? true
      };
    }

    res.status(200).json({
      success: true,
      categories: formattedCategories,
      homeContent: formattedContent
    });
  } catch (error) {
    console.error('Get public home data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home data'
    });
  }
};

/**
 * Universal Search across all Categories, Sub-categories (Brands), and Individual Services
 * GET /api/public/search?q=query&search=query&cityId=cityId
 */
const searchPublicServices = async (req, res) => {
  try {
    const rawQuery = (req.query.q || req.query.search || '').toString();
    const query = rawQuery.trim().replace(/\s+/g, ' ');
    const { cityId } = req.query;

    if (!query) {
      return res.status(200).json({
        success: true,
        services: [],
        suggestions: []
      });
    }

    const lowerQ = query.toLowerCase();

    // City filter helper
    const cityFilter = cityId ? {
      $or: [
        { cityIds: cityId },
        { cityIds: { $size: 0 } },
        { cityIds: { $exists: false } }
      ]
    } : {};

    // 1. Fetch Categories, Brands (Sub-categories), and Services in parallel
    const [categories, brands, services] = await Promise.all([
      Category.find({ status: 'active', ...cityFilter }).select('title slug homeIconUrl').lean(),
      Brand.find({ status: 'active', ...cityFilter }).select('title slug iconUrl logo imageUrl categoryIds categoryId sections basePrice discountPrice pricingUnit').lean(),
      Service.find({ status: 'active' }).populate('brandId', 'title iconUrl categoryIds categoryId').lean()
    ]);

    // Create Quick Lookup Maps for Category & Brand IDs
    const categoryMap = new Map();
    categories.forEach(c => {
      categoryMap.set(c._id.toString(), c);
    });

    const brandMap = new Map();
    brands.forEach(b => {
      brandMap.set(b._id.toString(), b);
    });

    // Helper to resolve parent Category for a Brand
    const getCategoryForBrand = (brand) => {
      if (!brand) return null;
      const catId = (brand.categoryIds && brand.categoryIds.length > 0)
        ? brand.categoryIds[0].toString()
        : (brand.categoryId ? brand.categoryId.toString() : null);
      return catId ? categoryMap.get(catId) : null;
    };

    const candidateResults = [];

    // Helper to calculate matching score based on priority requirements:
    // 1. Exact service-name match (score 100)
    // 2. Service name starts with query (score 85)
    // 3. Service name contains query (score 70)
    // 4. Sub-category (Brand) name match (score 55/50/40)
    // 5. Parent Category name match (score 35/30/20)
    const calculateScore = (serviceTitle, subCategoryTitle, categoryTitle) => {
      const sTitle = (serviceTitle || '').toLowerCase().trim();
      const subTitle = (subCategoryTitle || '').toLowerCase().trim();
      const catTitle = (categoryTitle || '').toLowerCase().trim();

      if (sTitle === lowerQ) return 100;
      if (sTitle.startsWith(lowerQ)) return 85;
      if (sTitle.includes(lowerQ)) return 70;

      if (subTitle === lowerQ) return 55;
      if (subTitle.startsWith(lowerQ)) return 50;
      if (subTitle.includes(lowerQ)) return 40;

      if (catTitle === lowerQ) return 35;
      if (catTitle.startsWith(lowerQ)) return 30;
      if (catTitle.includes(lowerQ)) return 20;

      return 0;
    };

    // A) Search Services from UserService collection
    services.forEach(svc => {
      const brand = svc.brandId && typeof svc.brandId === 'object' ? svc.brandId : (svc.brandId ? brandMap.get(svc.brandId.toString()) : null);
      const parentCat = svc.categoryId ? categoryMap.get(svc.categoryId.toString()) : getCategoryForBrand(brand);

      const sTitle = svc.title || '';
      const subTitle = brand?.title || '';
      const catTitle = parentCat?.title || '';

      const score = calculateScore(sTitle, subTitle, catTitle);

      if (score > 0) {
        candidateResults.push({
          id: svc._id.toString(),
          title: svc.title,
          slug: svc.slug || '',
          price: svc.discountPrice || svc.basePrice || 0,
          basePrice: svc.basePrice || 0,
          discountPrice: svc.discountPrice || null,
          pricingUnit: svc.pricingUnit || '',
          description: svc.description || '',
          icon: svc.iconUrl || brand?.iconUrl || '',
          categoryId: parentCat ? parentCat._id.toString() : null,
          category: catTitle,
          categoryTitle: catTitle,
          subCategoryId: brand ? brand._id.toString() : null,
          subCategoryName: subTitle,
          brandId: brand ? brand._id.toString() : null,
          brandName: subTitle,
          brandIcon: brand?.iconUrl || '',
          score
        });
      }
    });

    // B) Search Services embedded inside Brands (sections/cards or standalone Brand services)
    brands.forEach(brand => {
      const parentCat = getCategoryForBrand(brand);
      const subTitle = brand.title || '';
      const catTitle = parentCat?.title || '';

      if (Array.isArray(brand.sections) && brand.sections.length > 0) {
        brand.sections.forEach(section => {
          if (Array.isArray(section.cards) && section.cards.length > 0) {
            section.cards.forEach(card => {
              const cardTitle = card.title || '';
              const score = calculateScore(cardTitle, subTitle, catTitle);

              if (score > 0) {
                const cardId = card.id || card._id?.toString() || `${brand._id}-${cardTitle}`;
                candidateResults.push({
                  id: cardId,
                  title: cardTitle,
                  slug: brand.slug,
                  price: Number(card.price) || brand.basePrice || 0,
                  basePrice: Number(card.price) || brand.basePrice || 0,
                  discountPrice: card.originalPrice ? Number(card.price) : null,
                  pricingUnit: card.duration || brand.pricingUnit || '',
                  description: card.subtitle || card.description || '',
                  icon: card.imageUrl || brand.iconUrl || brand.logo || '',
                  categoryId: parentCat ? parentCat._id.toString() : (brand.categoryIds?.[0]?.toString() || null),
                  category: catTitle,
                  categoryTitle: catTitle,
                  subCategoryId: brand._id.toString(),
                  subCategoryName: subTitle,
                  brandId: brand._id.toString(),
                  brandName: subTitle,
                  brandIcon: brand.iconUrl || brand.logo || '',
                  score
                });
              }
            });
          }
        });
      } else {
        // Brand itself as a service
        const score = calculateScore(subTitle, subTitle, catTitle);
        if (score > 0) {
          candidateResults.push({
            id: brand._id.toString(),
            title: brand.title,
            slug: brand.slug,
            price: brand.basePrice || 0,
            basePrice: brand.basePrice || 0,
            discountPrice: brand.discountPrice || null,
            pricingUnit: brand.pricingUnit || '',
            description: brand.description || '',
            icon: brand.iconUrl || brand.logo || brand.imageUrl || '',
            categoryId: parentCat ? parentCat._id.toString() : (brand.categoryIds?.[0]?.toString() || null),
            category: catTitle,
            categoryTitle: catTitle,
            subCategoryId: brand._id.toString(),
            subCategoryName: subTitle,
            brandId: brand._id.toString(),
            brandName: subTitle,
            brandIcon: brand.iconUrl || brand.logo || '',
            score
          });
        }
      }
    });

    // C) Deduplicate results by ID
    const resultMap = new Map();
    candidateResults.forEach(item => {
      const existing = resultMap.get(item.id);
      if (!existing || item.score > existing.score) {
        resultMap.set(item.id, item);
      }
    });

    // D) Sort results by Score DESC, then title length ASC
    const sortedResults = Array.from(resultMap.values()).sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.title.length - b.title.length;
    });

    // E) Build Dynamic Fallback Suggestions if zero matches
    let suggestions = [];
    if (sortedResults.length === 0) {
      const popularNames = [];
      services.slice(0, 3).forEach(s => s.title && popularNames.push(s.title));
      brands.slice(0, 3).forEach(b => b.title && popularNames.push(b.title));
      categories.slice(0, 3).forEach(c => c.title && popularNames.push(c.title));
      suggestions = Array.from(new Set(popularNames)).slice(0, 4);
    }

    res.status(200).json({
      success: true,
      services: sortedResults,
      suggestions
    });
  } catch (error) {
    console.error('Universal service search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search services'
    });
  }
};

module.exports = {
  getPublicCategories,
  getPublicBrands,
  getPublicBrandBySlug,
  getPublicServices,
  getPublicHomeContent,
  getPublicHomeData,
  searchPublicServices
};
