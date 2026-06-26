import React, { memo, useRef } from 'react';
import { themeColors } from '../../../../theme';
import OptimizedImage from '../../../../components/common/OptimizedImage';
import OptimizedVideo from '../../../../components/common/OptimizedVideo';

const ServiceCard = memo(({ image, title, onClick, gif, youtubeUrl }) => {
  const cardRef = useRef(null);

  const getYouTubeVideoId = (url) => {
    if (!url) return null;
    const cleanUrl = url.trim();
    const shortsMatch = cleanUrl.match(/youtube\.com\/shorts\/([^?&]+)/);
    if (shortsMatch) return shortsMatch[1];
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = cleanUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const [isPlaying, setIsPlaying] = React.useState(true);

  const videoId = youtubeUrl ? getYouTubeVideoId(youtubeUrl) : null;
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? '1' : '0'}&loop=1&playlist=${videoId}&mute=0&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1`
    : null;

  const isCloudinaryVideo = (url) => {
    if (!url) return false;
    return url.includes('video/upload') || url.match(/\.(mp4|webm|ogg|mov)$|^https:\/\/res\.cloudinary\.com.*\/video\//i);
  };

  const renderMedia = () => {
    if (youtubeUrl && embedUrl) {
      return (
        <div className="relative w-full h-full">
          <iframe
            src={embedUrl}
            className="w-full h-full object-cover pointer-events-none"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
            title={title}
          />
        </div>
      );
    }

    const mediaUrl = gif || image;
    if (isCloudinaryVideo(mediaUrl)) {
      return (
        <OptimizedVideo
          src={mediaUrl}
          className="w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      );
    }

    if (mediaUrl) {
      return (
        <OptimizedImage
          src={mediaUrl}
          alt={title}
          className="w-full h-full object-cover"
          width={480}
        />
      );
    }

    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
        <svg
          className="w-16 h-16 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    );
  };


  return (
    <div
      ref={cardRef}
      className="relative min-w-[200px] md:min-w-[240px] h-[350px] md:h-[420px] rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 ease-out hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]"
      style={{
        boxShadow: themeColors.cardShadow,
        border: themeColors.cardBorder,
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
      onClick={onClick}
    >
      {renderMedia()}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pointer-events-none">
        <h3 className="text-white font-semibold text-base">{title}</h3>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsPlaying(!isPlaying);
        }}
        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
        title={isPlaying ? "Pause Video" : "Play Video"}
      >
        {isPlaying ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4 pl-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
    </div>
  );
});

ServiceCard.displayName = 'ServiceCard';
export default ServiceCard;

