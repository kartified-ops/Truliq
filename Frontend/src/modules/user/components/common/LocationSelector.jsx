import React from 'react';
import { FiChevronDown } from 'react-icons/fi';

const LocationSelector = ({ location, onLocationClick }) => {
  // Format location to show only city and state, rest with "..."
  const formatLocation = (loc) => {
    if (!loc) return '...';
    
    // Split by comma or hyphen to get parts
    const parts = loc.split(/[,|-]/).map(part => part.trim()).filter(part => part);
    if (parts.length <= 1) return 'Location Details...';
    
    // Find the index of the part used for the top title
    let topIndex = 0;
    for (let i = 0; i < Math.min(parts.length, 4); i++) {
      if (!/^\d/.test(parts[i]) && parts[i].length > 3) {
        topIndex = i;
        break;
      }
    }
    
    // Get the parts AFTER the top title
    let remainingParts = parts.slice(topIndex + 1);
    
    // If there's nothing after (e.g. it was the last part), use the parts BEFORE it
    if (remainingParts.length === 0) {
      remainingParts = parts.slice(0, topIndex);
    }
    
    if (remainingParts.length === 0) return 'Location Details...';

    // Return up to 2 parts for the subtitle
    return remainingParts.slice(0, 2).join(', ') + (remainingParts.length > 2 ? '...' : '');
    
    return '...';
  };

  const formattedLocation = formatLocation(location);

  return (
    <div 
      className="flex items-center gap-1.5 cursor-pointer"
      onClick={onLocationClick}
    >
      <span className="text-xs text-gray-700 truncate max-w-[140px] leading-tight text-right">
        {formattedLocation}
      </span>
      <FiChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: '#F59E0B' }} />
    </div>
  );
};

export default LocationSelector;


