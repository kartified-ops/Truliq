import React from 'react';
import { optimizeCloudinaryUrl } from '../../../../../utils/cloudinaryOptimize';

const Banner = React.memo(({ imageUrl, text, onClick }) => {
  if (!imageUrl) return null;

  // Optimize Cloudinary URLs for faster loading
  const optimizedUrl = optimizeCloudinaryUrl(imageUrl, { quality: 'auto', width: 1920 });

  return (
    <div className="mb-6 px-4 md:px-6 cursor-pointer group max-w-screen-xl mx-auto" onClick={onClick}>
      <div
        className="relative w-full h-44 sm:h-56 md:h-64 lg:h-72 xl:h-80 rounded-2xl md:rounded-3xl overflow-hidden shadow-md group-hover:shadow-2xl group-hover:scale-[1.008] transition-all duration-500 border border-slate-200/80 bg-slate-100"
      >
        <img
          src={optimizedUrl}
          alt={text || "Banner"}
          className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        {text ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 md:p-6 flex items-end z-10">
            <p className="text-white text-base md:text-xl font-bold drop-shadow-md line-clamp-2">{text}</p>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        )}
      </div>
    </div>
  );
});

Banner.displayName = 'Banner';

export default Banner;

