import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HiLocationMarker } from 'react-icons/hi';
import { gsap } from 'gsap';
import LocationSelector from '../common/LocationSelector';
import { animateLogo } from '../../../../utils/gsapAnimations';
import Logo from '../../../../components/common/Logo';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { themeColors } from '../../../../theme';

import CitySelectorModal from '../common/CitySelectorModal';
import { useCity } from '../../../../context/CityContext';
import { HiChevronDown } from 'react-icons/hi';

const Header = ({ location, onLocationClick, isGpsOff = false }) => {
  const logoRef = useRef(null);
  const { currentCity } = useCity();
  const [isCityModalOpen, setIsCityModalOpen] = React.useState(false);

  useEffect(() => {
    if (logoRef.current) {
      animateLogo(logoRef.current);
    }
  }, []);

  return (
    <header className="relative overflow-hidden">
      {/* Content wrapper with relative positioning */}
      <div className="relative z-10">
        <div className="w-full">
          {/* Top Row: Logo (Left) and Location (Right) */}
          <div className="px-4 py-2 flex items-center justify-between">
            {/* Left: Logo */}
            <Link
              to="/user"
              className="cursor-pointer shrink-0"
              onMouseEnter={() => {
                if (logoRef.current) {
                  gsap.to(logoRef.current, {
                    scale: 1.1,
                    filter: `drop-shadow(0 0 16px ${themeColors.brand.teal}40)`,
                    duration: 0.3,
                    ease: 'power2.out',
                  });
                }
              }}
              onMouseLeave={() => {
                if (logoRef.current) {
                  gsap.to(logoRef.current, {
                    scale: 1,
                    filter: '',
                    duration: 0.3,
                    ease: 'power2.out',
                  });
                }
              }}
            >
              <Logo
                ref={logoRef}
                className="h-10 sm:h-12 w-auto"
              />
            </Link>

            {/* Desktop Navigation - Hidden on Mobile */}
            <nav className="hidden lg:flex items-center gap-8 ml-10">
              <Link to="/user" className="text-gray-700 font-semibold hover:text-[#347989] transition-colors">Home</Link>
              <Link to="/user/my-bookings" className="text-gray-700 font-semibold hover:text-[#347989] transition-colors">Bookings</Link>
              <Link to="/user/scrap" className="text-gray-700 font-semibold hover:text-[#347989] transition-colors">Scrap</Link>
              <Link to="/user/cart" className="text-gray-700 font-semibold hover:text-[#347989] transition-colors">Cart</Link>
              <Link to="/user/account" className="text-gray-700 font-semibold hover:text-[#347989] transition-colors">Account</Link>
            </nav>

            {/* Right: City & Location */}
            <div className="flex flex-col items-end gap-1 flex-1 min-w-0 ml-4">
              {/* Location Selector */}
              <div className="flex flex-col items-end cursor-pointer" onClick={onLocationClick}>
                <div className="flex items-center gap-1 mb-0.5">
                  {/* Gradient Definition for Icons */}
                  <svg width="0" height="0" className="absolute">
                    <linearGradient id="Truliq-location-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={themeColors.brand.teal} />
                      <stop offset="50%" stopColor={themeColors.brand.yellow} />
                      <stop offset="100%" stopColor={themeColors.brand.orange} />
                    </linearGradient>
                  </svg>
                  <HiLocationMarker
                    className={`w-4 h-4 shrink-0 ${isGpsOff ? 'text-orange-500 animate-pulse' : ''}`}
                    style={isGpsOff ? { fill: '#f97316' } : { fill: 'url(#Truliq-location-gradient)' }}
                  />
                  <span className="text-sm font-bold truncate max-w-[160px]" style={{
                    background: isGpsOff ? '#f97316' : themeColors.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    {isGpsOff ? 'GPS is Off' : (() => {
                      if (!location || location === '...') return 'Select Location';
                      const parts = location.split(/[,|-]/).map(p => p.trim()).filter(p => p);
                      if (parts.length === 0) return 'Select Location';
                      let topPart = parts[0];
                      // Find first part that looks like a real area name (not just a number)
                      for (let i = 0; i < Math.min(parts.length, 4); i++) {
                        if (!/^\d/.test(parts[i]) && parts[i].length > 3) {
                          topPart = parts[i];
                          break;
                        }
                      }
                      return topPart;
                    })()}
                  </span>
                </div>
                {isGpsOff ? (
                  <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                    Tap to Turn On GPS
                  </span>
                ) : (
                  <LocationSelector
                    location={location}
                    onLocationClick={onLocationClick}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CitySelectorModal
        isOpen={isCityModalOpen}
        onClose={() => setIsCityModalOpen(false)}
      />
    </header>
  );
};

export default Header;

