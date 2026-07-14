import React, { useState, useEffect, useRef } from 'react';
import { OverlayView } from '@react-google-maps/api';

const AnimatedRiderMarker = ({ currentLocation, heading, iconSrc = "/MapRider.png" }) => {
  const [animatedLocation, setAnimatedLocation] = useState(currentLocation);
  const targetLocationRef = useRef(currentLocation);
  const animatedLocationRef = useRef(currentLocation);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!currentLocation) return;
    targetLocationRef.current = currentLocation;

    if (!animatedLocationRef.current) {
      animatedLocationRef.current = currentLocation;
      setAnimatedLocation(currentLocation);
      return;
    }

    const animateToTarget = () => {
      const target = targetLocationRef.current;
      const current = animatedLocationRef.current;
      if (!target || !current) return;

      const latDiff = target.lat - current.lat;
      const lngDiff = target.lng - current.lng;
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

      // Stop animating if very close to the target
      if (distance < 0.00001) {
        animatedLocationRef.current = target;
        setAnimatedLocation(target);
        return;
      }

      const lerpFactor = 0.1;
      const newLat = current.lat + latDiff * lerpFactor;
      const newLng = current.lng + lngDiff * lerpFactor;
      const newLocation = { lat: newLat, lng: newLng };

      animatedLocationRef.current = newLocation;
      setAnimatedLocation(newLocation);
      animationFrameRef.current = requestAnimationFrame(animateToTarget);
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animateToTarget);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentLocation]);

  if (!animatedLocation) return null;

  return (
    <OverlayView
      position={animatedLocation}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        style={{
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          cursor: 'pointer'
        }}
        className="pointer-events-none"
      >
        <div
          className="relative z-20 w-16 h-16"
          style={{
            transform: `rotate(${heading || 0}deg)`,
            transition: 'transform 0.3s ease-out'
          }}
        >
          <img
            src={iconSrc}
            alt="Rider"
            className="w-full h-full object-contain drop-shadow-xl rounded-full"
            onError={(e) => { e.target.onerror = null; e.target.src = "https://cdn-icons-png.flaticon.com/512/2972/2972185.png" }}
          />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-teal-500/30 rounded-full animate-ping z-10 pointer-events-none"></div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-12 h-3 bg-black/20 blur-sm rounded-full z-0"></div>
      </div>
    </OverlayView>
  );
};

export default AnimatedRiderMarker;
