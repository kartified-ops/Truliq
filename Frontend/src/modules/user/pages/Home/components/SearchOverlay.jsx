import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiArrowLeft, FiClock, FiTrendingUp, FiX, FiLayers, FiPlus, FiCheck } from 'react-icons/fi';
import { publicCatalogService } from '../../../../../services/catalogService';
import { useCart } from '../../../../../context/CartContext';
import { themeColors } from '../../../../../theme';
import { toast } from 'react-hot-toast';

const toAssetUrl = (url) => {
  if (!url) return '';
  const clean = url.replace('/api/upload', '/upload');
  if (clean.startsWith('http')) return clean;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
};

const SearchOverlay = ({ isOpen, onClose, categories = [], onCategoryClick }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [trendingServices, setTrendingServices] = useState([]);
  const inputRef = useRef(null);

  // Load recent searches and trending services on mount
  useEffect(() => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved).slice(0, 5));
    }

    // Fetch trending services (Most Booked)
    const fetchTrending = async () => {
      try {
        const res = await publicCatalogService.getHomeContent();
        if (res.success && res.homeContent?.booked && res.homeContent.booked.length > 0) {
          const filtered = res.homeContent.booked.filter(s =>
            !s.title.toLowerCase().includes('fan install') &&
            !s.title.toLowerCase().includes('fan repair') &&
            !s.title.toLowerCase().includes('top load') &&
            !s.title.toLowerCase().includes('automatic')
          );
          setTrendingServices(filtered.slice(0, 5));
        } else {
          setTrendingServices([]);
        }
      } catch (error) {
        console.error("Failed to load trending services", error);
        setTrendingServices([]);
      }
    };
    fetchTrending();
  }, []);

  // Lock background scroll when search overlay is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      const scrollY = window.scrollY;

      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.overflow = originalOverflow;
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
      setResults([]);
      setSuggestions([]);
    }
  }, [isOpen]);

  // Debounced Universal Search across Categories, Sub-categories, & Services (350ms)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await publicCatalogService.searchServices(trimmed);
        if (response.success) {
          setResults(response.services || []);
          setSuggestions(response.suggestions || []);
        } else {
          setResults([]);
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Universal Search failed", error);
        setResults([]);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  // Save to recent searches
  const recordSearchTerm = (term) => {
    if (!term || !term.trim()) return;
    const cleanTerm = term.trim();
    const newRecent = [cleanTerm, ...recentSearches.filter(s => s.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('recent_searches', JSON.stringify(newRecent));
  };

  // Direct Add to Cart flow from search card
  const handleAddToCart = async (e, service) => {
    e.stopPropagation();
    if (!localStorage.getItem('accessToken')) {
      toast.error('Please login to add services to cart');
      navigate('/user/login');
      return;
    }

    setAddingId(service.id);
    recordSearchTerm(service.title);

    try {
      const cartItemData = {
        serviceId: service.id,
        categoryId: service.categoryId,
        title: service.title,
        description: service.description || '',
        icon: toAssetUrl(service.icon || ''),
        category: service.category || service.categoryTitle || 'Service',
        categoryTitle: service.category || service.categoryTitle || 'Service',
        sectionId: service.brandId || service.subCategoryId || null,
        sectionTitle: service.subCategoryName || service.brandName || '',
        sectionIcon: toAssetUrl(service.brandIcon || ''),
        price: Number(service.price || service.discountPrice || service.basePrice || 0),
        originalPrice: service.discountPrice && service.basePrice ? Number(service.basePrice) : null,
        unitPrice: Number(service.price || service.discountPrice || service.basePrice || 0),
        serviceCount: 1,
        rating: "4.8",
        reviews: "1k+",
        vendorId: service.vendorId || null
      };

      const response = await addToCart(cartItemData);
      if (response.success) {
        toast.success(`${service.title} added to cart!`);
        onClose();
        navigate('/user/cart');
      } else {
        toast.error(response.message || 'Failed to add to cart');
      }
    } catch (error) {
      toast.error('Failed to add to cart');
    } finally {
      setAddingId(null);
    }
  };

  const handleResultClick = (item) => {
    recordSearchTerm(item.title);
    onClose();

    // 1. Handle Category Click
    if (item.isCategory) {
      onCategoryClick(item);
      return;
    }

    // 2. Handle Service/Brand Click
    let catId = item.categoryId || item.targetCategoryId;
    let category = null;

    if (catId) {
      category = categories.find(c => (c.id === catId || c._id === catId));
    }

    if (!category && item.category) {
      category = categories.find(c => c.title.toLowerCase() === item.category.toLowerCase());
    }

    if (!category) {
      category = { id: catId || 'custom', title: item.category || 'Services' };
    }

    const initialBrand = (item.brandId || item.subCategoryId) ? {
      id: item.brandId || item.subCategoryId,
      title: item.subCategoryName || item.brandName || item.category,
      iconUrl: item.brandIcon || item.icon
    } : { id: 'direct-services' };

    onCategoryClick({
      ...category,
      initialBrand: initialBrand,
      initialServiceId: item.id
    });
  };

  const handleTermClick = (term) => {
    setQuery(term);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_searches');
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-white z-[9999] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-100 shadow-sm bg-white">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <FiArrowLeft className="w-6 h-6 text-gray-700" />
            </button>
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value.replace(/^\s+/, ''))}
                placeholder="Search for categories, sub-categories, or services..."
                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-100 transition-all border-none outline-none text-base font-medium text-gray-900"
                style={{ '--tw-ring-color': `${themeColors.primary}33` }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
                >
                  <FiX className="w-3.5 h-3.5 text-gray-600" />
                </button>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto bg-gray-50/50">
            {query.trim().length >= 1 ? (
              // Search Results List
              <div className="p-4 space-y-3">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16 opacity-60">
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin mb-2" style={{ borderTopColor: themeColors.primary }}></div>
                    <p className="text-sm font-semibold text-gray-500">Searching services...</p>
                  </div>
                ) : results.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-3 mt-1 px-1">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Search Results</p>
                      <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">{results.length} found</span>
                    </div>

                    {results.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleResultClick(item)}
                        className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 hover:border-primary-200 shadow-sm active:scale-[0.99] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-4 min-w-0 pr-3">
                          <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 group-hover:bg-primary-50/30 transition-colors">
                            {item.icon ? (
                              <img
                                src={toAssetUrl(item.icon)}
                                alt=""
                                className="w-10 h-10 object-contain group-hover:scale-110 transition-transform duration-300"
                              />
                            ) : (
                              <FiLayers className="w-7 h-7 text-gray-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-gray-900 text-[15px] truncate group-hover:text-primary-600 transition-colors leading-snug">
                              {item.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.category && (
                                <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md uppercase tracking-tight truncate max-w-[140px]">
                                  {item.category}
                                </span>
                              )}
                              {item.subCategoryName && item.subCategoryName !== item.title && (
                                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md uppercase tracking-tight truncate max-w-[140px]">
                                  {item.subCategoryName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-1.5">
                              <span className="text-sm font-black text-emerald-600">₹{item.price}</span>
                              {item.pricingUnit && (
                                <span className="text-[11px] font-bold text-gray-400 lowercase">/ {item.pricingUnit}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Add Button */}
                        <button
                          onClick={(e) => handleAddToCart(e, item)}
                          disabled={addingId === item.id}
                          className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95 border border-emerald-200/60"
                        >
                          {addingId === item.id ? (
                            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <FiPlus className="w-3.5 h-3.5 stroke-[3]" /> ADD
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-16 px-4">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiSearch className="w-8 h-8 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">No services found</h3>
                    <p className="text-sm text-gray-500 mb-6">No service matching "{query}" was found.</p>

                    {/* Dynamic Suggestions */}
                    {suggestions.length > 0 && (
                      <div className="max-w-sm mx-auto bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-left">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Try searching for:</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestions.map((sug, i) => (
                            <button
                              key={i}
                              onClick={() => handleTermClick(sug)}
                              className="px-3.5 py-2 bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border border-gray-200 hover:border-emerald-200 rounded-xl text-xs font-bold transition-all"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Default State (Recent & Popular)
              <div className="p-5 space-y-8">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <section>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <FiClock className="text-gray-400" /> Recent Searches
                      </h3>
                      <button onClick={clearRecent} className="text-xs text-red-500 font-bold hover:text-red-600">Clear</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => handleTermClick(term)}
                          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Popular Services */}
                {trendingServices.length > 0 && (
                  <section>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                      <FiTrendingUp className="text-blue-500" /> Trending Services
                    </h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                      {trendingServices.map((service) => (
                        <button
                          key={service.id}
                          onClick={() => handleTermClick(service.title)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 bg-white transition-colors text-left group"
                        >
                          <div className="flex items-center gap-3">
                            {service.imageUrl && (
                              <img src={toAssetUrl(service.imageUrl)} alt="" className="w-8 h-8 rounded-lg object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            )}
                            <span className="font-semibold text-gray-800 text-sm group-hover:text-gray-900 transition-colors">{service.title}</span>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">Search</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SearchOverlay;


